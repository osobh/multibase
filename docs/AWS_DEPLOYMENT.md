# AWS Deployment Guide

Complete step-by-step guide for deploying Supabase to AWS using EC2, Application Load Balancer (ALB), RDS, and S3.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Step 1: VPC and Networking](#step-1-vpc-and-networking)
- [Step 2: RDS PostgreSQL Database](#step-2-rds-postgresql-database)
- [Step 3: S3 Storage Bucket](#step-3-s3-storage-bucket)
- [Step 4: IAM Roles and Policies](#step-4-iam-roles-and-policies)
- [Step 5: EC2 Instance](#step-5-ec2-instance)
- [Step 6: Application Load Balancer](#step-6-application-load-balancer)
- [Step 7: SSL Certificate](#step-7-ssl-certificate)
- [Step 8: Route53 DNS](#step-8-route53-dns)
- [Step 9: Deploy Supabase](#step-9-deploy-supabase)
- [Step 10: Verification and Testing](#step-10-verification-and-testing)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet
   ↓
Route53 (DNS)
   ↓
Application Load Balancer (ALB)
├─ HTTPS Listener (443) → SSL Certificate
└─ HTTP Listener (80) → Redirect to HTTPS
   ↓
Target Group (Health Checks)
   ↓
EC2 Instance (Docker Compose)
├─ Kong API Gateway (8000)
├─ Supabase Services (containers)
├─ Storage API → S3 Bucket
└─ Auth, REST, Realtime, etc.
   ↓
RDS PostgreSQL (5432)
```

**Key Components:**
- **ALB**: Entry point, SSL termination, load balancing
- **EC2**: Runs Docker containers
- **RDS**: Managed PostgreSQL database
- **S3**: File storage backend
- **IAM**: Access control for S3 and AWS services

---

## Prerequisites

- AWS Account with appropriate permissions
- Domain name (for SSL certificate and custom URL)
- Basic knowledge of AWS console
- SSH key pair for EC2 access
- Estimated monthly cost: $50-200 depending on instance sizes

**Tools you'll need locally:**
- AWS CLI (optional but recommended)
- SSH client
- Web browser

---

## Step 1: VPC and Networking

### 1.1 Create VPC (or use existing)

**Option A: Use Default VPC**
- Most AWS accounts have a default VPC
- Navigate to **VPC Dashboard** → Check if default VPC exists
- Note the VPC ID (e.g., `vpc-12345678`)

**Option B: Create New VPC**

1. Go to **VPC** → **Your VPCs** → **Create VPC**
2. Settings:
   - **Name**: `supabase-vpc`
   - **IPv4 CIDR**: `10.0.0.0/16`
   - **Tenancy**: Default
3. **Create VPC**

### 1.2 Create Subnets

You need at least 2 subnets in different Availability Zones (AZs) for ALB.

1. Go to **Subnets** → **Create subnet**
2. **Subnet 1** (Public):
   - **VPC**: Select your VPC
   - **Name**: `supabase-public-1a`
   - **AZ**: `us-east-1a` (or your region's first AZ)
   - **CIDR**: `10.0.1.0/24`
3. **Subnet 2** (Public):
   - **Name**: `supabase-public-1b`
   - **AZ**: `us-east-1b` (different AZ)
   - **CIDR**: `10.0.2.0/24`
4. Click **Create subnet**

### 1.3 Internet Gateway

1. Go to **Internet Gateways** → **Create internet gateway**
2. **Name**: `supabase-igw`
3. **Create** → **Attach to VPC** (select your VPC)

### 1.4 Route Table

1. Go to **Route Tables** → Find the main route table for your VPC
2. **Edit routes** → **Add route**:
   - **Destination**: `0.0.0.0/0`
   - **Target**: Internet Gateway (your IGW)
3. **Associate subnets**:
   - Select both public subnets created above

---

## Step 2: RDS PostgreSQL Database

### 2.1 Create Security Group for RDS

1. Go to **EC2** → **Security Groups** → **Create security group**
2. Settings:
   - **Name**: `supabase-rds-sg`
   - **Description**: Security group for Supabase RDS
   - **VPC**: Your VPC
3. **Inbound rules**:
   ```
   Type: PostgreSQL
   Port: 5432
   Source: Custom - 0.0.0.0/0 (will be restricted later to EC2 SG)
   ```
4. **Create security group**

### 2.2 Create RDS PostgreSQL Instance

1. Go to **RDS** → **Databases** → **Create database**
2. **Engine options**:
   - Engine: **PostgreSQL**
   - Version: **15.x** (latest minor version)
3. **Templates**: **Production** (or Dev/Test for testing)
4. **Settings**:
   - **DB instance identifier**: `supabase-db`
   - **Master username**: `postgres`
   - **Master password**: (strong password - save securely!)
5. **Instance configuration**:
   - **Instance class**: `db.t3.micro` (for testing) or `db.t3.medium` (production)
6. **Storage**:
   - **Storage type**: General Purpose SSD (gp3)
   - **Allocated storage**: 20 GB
   - **Enable storage autoscaling**: Yes
   - **Maximum storage**: 100 GB
7. **Connectivity**:
   - **VPC**: Your VPC
   - **Public access**: **No** (recommended)
   - **VPC security group**: `supabase-rds-sg`
   - **Availability Zone**: No preference
8. **Additional configuration**:
   - **Initial database name**: `postgres`
   - **DB parameter group**: Create new or use existing
9. **Backup**:
   - **Enable automated backups**: Yes
   - **Retention period**: 7 days
10. **Create database** (takes 5-10 minutes)

### 2.3 Enable Logical Replication

**Critical for Realtime!**

1. Go to **RDS** → **Parameter groups** → **Create parameter group**
   - **Family**: `postgres15`
   - **Name**: `supabase-postgres15-logical-replication`
   - **Description**: Enables logical replication for Supabase Realtime
2. **Edit parameters**:
   - Search for `rds.logical_replication`
   - Set to: **1** (enabled)
   - **Save changes**
3. **Modify your RDS instance**:
   - Go to your database → **Modify**
   - **DB parameter group**: Select the one you just created
   - **Apply immediately**: Yes
   - **Continue** → **Modify DB instance**
4. **Reboot the database** (required for parameter changes):
   - Select database → **Actions** → **Reboot**

### 2.4 Note RDS Endpoint

After creation, go to your RDS instance and copy:
- **Endpoint**: `supabase-db.c9akciq32.us-east-1.rds.amazonaws.com`
- **Port**: `5432`

You'll need this for your `.env` file.

---

## Step 3: S3 Storage Bucket

### 3.1 Create S3 Bucket

1. Go to **S3** → **Create bucket**
2. Settings:
   - **Name**: `supabase-storage-your-unique-name` (must be globally unique)
   - **Region**: Same as your EC2 (e.g., `us-east-1`)
   - **Block all public access**: ✅ **Enabled** (recommended, access via Supabase API only)
3. **Versioning**: Optional (recommended for production)
4. **Encryption**: **SSE-S3** (server-side encryption)
5. **Create bucket**

### 3.2 Configure CORS for S3 Bucket

This is necessary for browser uploads.

1. Go to your bucket → **Permissions** → **CORS**
2. Add this configuration:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://your-domain.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

Replace `https://your-domain.com` with your actual domain(s).

### 3.3 Note Bucket Details

Save these for later:
- **Bucket name**: `supabase-storage-your-unique-name`
- **Region**: `us-east-1` (or your region)

---

## Step 4: IAM Roles and Policies

### 4.1 Create IAM Policy for S3 Access

1. Go to **IAM** → **Policies** → **Create policy**
2. **Service**: S3
3. **Actions**:
   - List: `ListBucket`
   - Read: `GetObject`
   - Write: `PutObject`, `DeleteObject`
4. **Resources**:
   - Bucket: `arn:aws:s3:::supabase-storage-your-unique-name`
   - Objects: `arn:aws:s3:::supabase-storage-your-unique-name/*`
5. Or use JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::supabase-storage-your-unique-name"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::supabase-storage-your-unique-name/*"
    }
  ]
}
```

6. **Name**: `supabase-s3-access-policy`
7. **Create policy**

### 4.2 Create IAM Role for EC2

1. Go to **IAM** → **Roles** → **Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: EC2
4. **Attach policies**:
   - `supabase-s3-access-policy` (created above)
   - Optional: `AmazonSSMManagedInstanceCore` (for SSM access)
5. **Role name**: `supabase-ec2-role`
6. **Create role**

---

## Step 5: EC2 Instance

### 5.1 Create Security Groups

**EC2 Security Group:**

1. **Name**: `supabase-ec2-sg`
2. **Inbound rules**:
   ```
   Type          Port    Source              Description
   SSH           22      Your-IP/32          SSH access
   Custom TCP    8000    supabase-alb-sg     Kong API (from ALB)
   All traffic   All     Self                Inter-container communication
   ```
3. **Outbound rules**:
   ```
   Type          Port    Destination         Description
   HTTPS         443     0.0.0.0/0           Internet access
   PostgreSQL    5432    supabase-rds-sg     Database access
   All traffic   All     Self                Inter-container
   ```

**ALB Security Group:**

1. **Name**: `supabase-alb-sg`
2. **Inbound rules**:
   ```
   Type     Port    Source          Description
   HTTPS    443     0.0.0.0/0       Internet HTTPS
   HTTP     80      0.0.0.0/0       Internet HTTP
   ```
3. **Outbound rules**:
   ```
   Type          Port    Destination       Description
   Custom TCP    8000    supabase-ec2-sg   Forward to Kong
   ```

### 5.2 Update RDS Security Group

Now restrict RDS to only accept connections from EC2:

1. Go to `supabase-rds-sg`
2. **Edit inbound rules**:
   - Change source from `0.0.0.0/0` to `supabase-ec2-sg`

### 5.3 Launch EC2 Instance

1. Go to **EC2** → **Instances** → **Launch instance**
2. **Name**: `supabase-server`
3. **AMI**: **Ubuntu Server 22.04 LTS** (free tier eligible)
4. **Instance type**:
   - Development: `t3.medium` (2 vCPU, 4 GB RAM)
   - Production: `t3.large` or larger (2 vCPU, 8 GB RAM)
5. **Key pair**: Select existing or create new
6. **Network settings**:
   - **VPC**: Your VPC
   - **Subnet**: One of your public subnets
   - **Auto-assign public IP**: Enable
   - **Security group**: `supabase-ec2-sg`
7. **Configure storage**: 30 GB gp3
8. **Advanced details**:
   - **IAM instance profile**: `supabase-ec2-role`
9. **Launch instance**

### 5.4 Connect and Install Docker

```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version

# Log out and back in for group changes to take effect
exit
# SSH back in
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

---

## Step 6: Application Load Balancer

### 6.1 Create Target Group

1. Go to **EC2** → **Target Groups** → **Create target group**
2. **Target type**: Instances
3. **Target group name**: `supabase-kong-tg`
4. **Protocol**: HTTP
5. **Port**: 8000
6. **VPC**: Your VPC
7. **Protocol version**: HTTP1
8. **Health check settings**:
   - **Protocol**: HTTP
   - **Path**: `/`
   - **Success codes**: `404` (Kong returns 404 for root, which is OK!)
   - **Advanced settings**:
     - **Healthy threshold**: 2
     - **Unhealthy threshold**: 3
     - **Timeout**: 5 seconds
     - **Interval**: 30 seconds
9. **Next** → **Register targets**:
   - Select your EC2 instance
   - **Ports for the selected instances**: 8000
   - **Include as pending below**
10. **Create target group**

### 6.2 Configure Sticky Sessions

**Critical for Realtime WebSocket connections!**

1. Go to your target group → **Attributes** → **Edit**
2. **Stickiness**: ✅ Enable
3. **Stickiness type**: Load balancer generated cookie
4. **Stickiness duration**: 86400 seconds (24 hours)
5. **Save changes**

### 6.3 Create Application Load Balancer

1. Go to **EC2** → **Load Balancers** → **Create load balancer**
2. Select **Application Load Balancer**
3. **Basic configuration**:
   - **Name**: `supabase-alb`
   - **Scheme**: Internet-facing
   - **IP address type**: IPv4
4. **Network mapping**:
   - **VPC**: Your VPC
   - **Mappings**: Select both availability zones and their public subnets
5. **Security groups**: `supabase-alb-sg`
6. **Listeners**:
   - **Protocol**: HTTP
   - **Port**: 80
   - **Default action**: Forward to `supabase-kong-tg`
7. **Create load balancer**

Note the ALB DNS name: `supabase-alb-123456789.us-east-1.elb.amazonaws.com`

---

## Step 7: SSL Certificate

### 7.1 Request Certificate in ACM

1. Go to **Certificate Manager** (ACM)
2. Ensure you're in the **same region** as your ALB
3. **Request certificate**
4. **Certificate type**: Public certificate
5. **Domain names**:
   - `api.your-domain.com` (or your chosen subdomain)
   - Optional: `*.your-domain.com` (wildcard)
6. **Validation method**: DNS validation (recommended)
7. **Request**

### 7.2 Validate Certificate

1. Click on your certificate
2. **Create records in Route 53** (if using Route 53)
   - Or copy CNAME records to your DNS provider
3. Wait for validation (can take 5-30 minutes)
4. Status should change to **Issued**

### 7.3 Add HTTPS Listener to ALB

1. Go to your ALB → **Listeners** → **Add listener**
2. **Protocol**: HTTPS
3. **Port**: 443
4. **Default action**: Forward to `supabase-kong-tg`
5. **Security policy**: ELBSecurityPolicy-TLS13-1-2-2021-06
6. **Default SSL/TLS certificate**: Select your ACM certificate
7. **Add**

### 7.4 Update HTTP Listener (Redirect to HTTPS)

1. Edit the HTTP:80 listener
2. **Remove** forward action
3. **Add** redirect action:
   - **Protocol**: HTTPS
   - **Port**: 443
   - **Status code**: 301 (Permanent)
4. **Save**

---

## Step 8: Route53 DNS

If your domain is in Route53:

1. Go to **Route 53** → **Hosted zones** → Your domain
2. **Create record**:
   - **Record name**: `api` (or your subdomain)
   - **Record type**: A
   - **Alias**: ✅ Enable
   - **Route traffic to**:
     - Alias to Application Load Balancer
     - Region: Your region
     - Load balancer: Your ALB
   - **Routing policy**: Simple
3. **Create records**

If using another DNS provider, create an A or CNAME record pointing to your ALB DNS name.

---

## Step 9: Deploy Supabase

### 9.1 Clone Repository on EC2

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Clone your repository
git clone https://github.com/yourusername/your-supabase-repo.git
cd your-supabase-repo
```

### 9.2 Create .env File

```bash
# Copy AWS environment template
cp .env.aws.example .env

# Edit configuration
nano .env
```

**Key values to set:**

```bash
# Secrets - Generate new secure values!
POSTGRES_PASSWORD=your-strong-password
JWT_SECRET=$(openssl rand -base64 32)
DASHBOARD_PASSWORD=your-dashboard-password
SECRET_KEY_BASE=$(openssl rand -base64 32)
VAULT_ENC_KEY=$(openssl rand -base64 32)

# Generate JWT keys
ANON_KEY=      # Generate using supabase CLI or online generator
SERVICE_ROLE_KEY=  # Generate using supabase CLI or online generator

# Database (RDS)
POSTGRES_HOST=supabase-db.c9akciq32.us-east-1.rds.amazonaws.com
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# URLs
SITE_URL=https://your-app.com
API_EXTERNAL_URL=https://api.your-domain.com
SUPABASE_PUBLIC_URL=https://api.your-domain.com

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET=supabase-storage-your-unique-name
# Leave access keys empty if using IAM role:
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Email (AWS SES)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_ADMIN_EMAIL=no-reply@your-domain.com
```

### 9.3 Deploy Supabase with AWS Configuration

```bash
# Use AWS-specific compose file
docker-compose -f docker-compose.yml -f docker-compose.aws.yml up -d

# Check status
docker-compose ps

# Check logs
docker-compose logs -f kong
docker-compose logs -f auth
docker-compose logs -f realtime
```

### 9.4 Wait for Services to Start

```bash
# Monitor startup (takes 2-5 minutes)
watch docker-compose ps

# All services should show "Up" and "healthy"
```

---

## Step 10: Verification and Testing

### 10.1 Test ALB Health Checks

1. Go to **EC2** → **Target Groups** → `supabase-kong-tg`
2. **Targets** tab → Should show **healthy**
3. If unhealthy, check:
   - Security groups
   - Kong container is running: `docker ps | grep kong`
   - Kong logs: `docker logs supabase-kong`

### 10.2 Test API Access

```bash
# Test through ALB (from your local machine)
curl -I https://api.your-domain.com

# Should return:
# HTTP/2 404
# server: kong/...

# Test auth endpoint
curl https://api.your-domain.com/auth/v1/health

# Test storage endpoint
curl https://api.your-domain.com/storage/v1/status

# Test with API key
curl https://api.your-domain.com/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
```

### 10.3 Test with Supabase Client

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://api.your-domain.com',
  'YOUR_ANON_KEY'
)

// Test auth
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'test-password'
})

console.log('Signup result:', { data, error })

// Test storage
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('test-bucket')
  .upload('test.txt', new Blob(['Hello']))

console.log('Upload result:', { uploadData, uploadError })

// Test realtime
const channel = supabase.channel('test')
channel.subscribe((status) => {
  console.log('Realtime status:', status)
})
```

### 10.4 Access Studio Dashboard

```bash
# Option 1: SSH Tunnel (Recommended)
ssh -i your-key.pem -L 3000:localhost:3000 ubuntu@your-ec2-ip

# Then access: http://localhost:3000

# Option 2: Expose through Kong (update kong.yml first)
# Access: https://api.your-domain.com
# Login with DASHBOARD_USERNAME and DASHBOARD_PASSWORD
```

---

## Cost Optimization

### Estimated Monthly Costs

```
EC2 t3.medium:        $30-40/month
RDS db.t3.micro:      $15-25/month
ALB:                  $20-25/month
S3 storage:           $0.023/GB (~$1-10/month)
Data transfer:        Variable ($0.09/GB out)
Total:                ~$70-100/month minimum
```

### Cost Savings Tips

1. **Use Reserved Instances** for EC2/RDS (save 30-40%)
2. **Right-size instances**: Start small, scale as needed
3. **Use S3 Lifecycle Policies**: Move old files to Glacier
4. **CloudFront CDN**: Cache static content, reduce origin requests
5. **Auto-scaling**: Scale down during low traffic
6. **Spot Instances**: For non-critical environments (save up to 90%)

---

## Troubleshooting

See the comprehensive [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues.

**Quick fixes:**

1. **ALB health check failing:**
   - Check security group allows 8000 from ALB SG to EC2 SG
   - Verify Kong is running: `docker ps | grep kong`
   - Check success codes include 404

2. **Can't connect to RDS:**
   - Verify EC2 security group allows 5432 from EC2
   - Check RDS endpoint in .env
   - Test: `docker exec supabase-db psql -h RDS-ENDPOINT -U postgres`

3. **S3 upload fails:**
   - Verify IAM role attached to EC2
   - Check S3 bucket name in .env
   - Test: `docker exec supabase-storage env | grep S3`

4. **Realtime not working:**
   - Enable sticky sessions on target group
   - Check container name: `docker ps | grep realtime`
   - See [REALTIME_CONFIG.md](./REALTIME_CONFIG.md)

---

## Next Steps

- [ ] Set up automated backups
- [ ] Configure CloudWatch monitoring
- [ ] Set up AWS WAF for security
- [ ] Enable CloudFront CDN
- [ ] Configure Auto Scaling
- [ ] Set up CI/CD pipeline
- [ ] Implement disaster recovery plan

---

## Related Documentation

- [PORT_REFERENCE.md](./PORT_REFERENCE.md) - All service ports
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [STORAGE_S3.md](./STORAGE_S3.md) - Detailed S3 setup
- [REALTIME_CONFIG.md](./REALTIME_CONFIG.md) - Realtime configuration
- [CORS_CONFIGURATION.md](./CORS_CONFIGURATION.md) - CORS setup
