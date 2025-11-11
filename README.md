# Supabase Secure Self-Hosting Deployment Manager

This repository provides a robust, secure, and reproducible workflow for creating and managing self-hosted Supabase deployments using Docker Compose.

---

## Directory Structure

All Supabase deployments are created inside a dedicated `projects/` directory.  
Each deployment is isolated in its own subdirectory:

---

## File Descriptions

- **setup_secure_supabase.sh**: Main setup script. Orchestrates project creation, prompts for credentials, generates keys, and starts Docker Compose.
- **supabase_manager.py**: Project management CLI. Handles create, start, stop, reset, status, and list commands for deployments.
- **supabase_setup.py**: Python project generator. Creates the directory structure and all config/template files for a new deployment.
- **generate_keys.py**: Generates secure API keys and updates the `.env` file for each deployment.
- **requirements.txt**: Python dependencies required for the management scripts.
- **sample_security_policies.sql**: Example Row Level Security (RLS) policies for your database.
- **security_checklist.md**: Security best practices and checklist for your deployment.
- **vector.yml**: Default Vector logging configuration template.
- **update_security.py**: (If present) Script for updating security settings or policies.
- **test_security.py**: (If present) Script for testing security policies or deployment.
- **README.md**: This documentation file.
- **.gitignore**: Ensures secrets and environment files in `projects/` are not committed to version control.

**Project directories** (under `/projects/<project-name>/`) contain:
- `docker-compose.yml`, `.env`, `volumes/`, `sample_security_policies.sql`, `security_checklist.md`, and a project-specific `README.md`.

---

```
/projects
  /myproject
    docker-compose.yml
    .env
    volumes/
    sample_security_policies.sql
    security_checklist.md
    README.md
```

**Note:**  
The `projects/` directory is included in `.gitignore` to ensure that secrets and environment files are never committed to version control.

---

## Quick Start

### 1. Prerequisites

- Python 3.7+
- Docker and Docker Compose
- Python dependencies (install with):
  ```
  pip install -r requirements.txt
  ```

### 2. Create a New Supabase Deployment

Run the setup script from the root directory:

```bash
./setup_secure_supabase.sh <project-name> [base-port]
```

- You will be prompted for dashboard credentials (username and password).
- Secure API keys will be generated automatically.
- All files will be created in `projects/<project-name>/`.

### 3. Start and Manage Your Deployment

```bash
cd projects/<project-name>
docker compose up -d
```

To stop services:

```bash
docker compose down
```

---

## Security Model

- **Secrets and environment files** are kept out of version control by default (`projects/` is in `.gitignore`).
- Each deployment includes:
  - `security_checklist.md` — follow this for best practices.
  - `sample_security_policies.sql` — example Row Level Security (RLS) policies.
- You are prompted to set custom dashboard credentials at setup time.
- Secure API keys are generated for each deployment.

---

## Project Management

- All management commands (`create`, `start`, `stop`, `reset`, `status`, `list`) are available via `supabase_manager.py`.
- Example:  
  ```bash
  python supabase_manager.py list
  python supabase_manager.py start <project-name>
  ```

---

## Updating and Customizing

- To update a deployment, re-run the setup script or use the management commands.
- You can customize the generated files in each project directory as needed.
- For advanced configuration, edit the generated `docker-compose.yml` or `.env` in your project directory.

---

## Example Usage

```bash
# Create a new deployment
./setup_secure_supabase.sh myproject

# Start the deployment
cd projects/myproject
docker compose up -d

# Stop the deployment
docker compose down
```

---

## Cloud Deployment

This project supports deployment to various cloud platforms including AWS, Google Cloud, Azure, and generic cloud VMs.

### Quick Start by Platform

#### AWS (EC2 + ALB + RDS + S3)
```bash
# 1. Create AWS infrastructure (RDS, S3, ALB, EC2)
# See: docs/AWS_DEPLOYMENT.md for detailed guide

# 2. Use AWS-specific configuration
cp .env.aws.example .env
# Edit .env with your AWS resource details

# 3. Deploy with AWS optimizations
docker-compose -f docker-compose.yml -f docker-compose.aws.yml up -d
```

📖 **[Complete AWS Deployment Guide →](docs/AWS_DEPLOYMENT.md)**

#### Generic Cloud VM (DigitalOcean, Linode, Vultr, etc.)
```bash
# 1. Create a VM (4GB RAM minimum, 8GB recommended)
# 2. Install Docker and Docker Compose
# 3. Clone this repository
# 4. Run setup script
./setup_secure_supabase.sh myproject

# 5. Configure for cloud
# Update .env with your domain and settings
# Update kong.yml with your CORS origins

# 6. Deploy
cd projects/myproject
docker compose up -d
```

📖 **[Cloud VM Deployment Guide →](docs/CLOUD_VM_DEPLOYMENT.md)** *(coming soon)*

### Service Port Reference

When deploying behind a load balancer (AWS ALB, nginx, Traefik), all traffic should route through **Kong API Gateway on port 8000**.

| Service | Port | Exposed? | Notes |
|---------|------|----------|-------|
| **Kong (API Gateway)** | 8000 | ✅ Yes | Main entry point - point your load balancer here |
| **Studio (Dashboard)** | 3000 | Optional | Admin UI - recommended for internal access only |
| PostgreSQL | 5432 | No | Use RDS/managed DB for cloud |
| Pooler | 6543 | Optional | Connection pooling |

**All other services** (Auth, REST, Storage, Realtime, Functions) are internal and accessed through Kong.

📖 **[Complete Port Reference →](docs/PORT_REFERENCE.md)**

### Critical Cloud Configuration

#### 1. CORS Configuration
For cloud deployments, you MUST configure CORS in `kong.yml` with your actual domains:

```yaml
# In kong.yml
- name: cors
  config:
    origins:
      - "https://your-app.com"
      - "https://staging.your-app.com"
```

The default `kong.yml` has been updated with comprehensive CORS headers required for all Supabase features.

📖 **[CORS Configuration Guide →](docs/CORS_CONFIGURATION.md)** *(coming soon)*

#### 2. Realtime Container Naming

**Critical:** The Realtime container MUST be named with this pattern:
```yaml
realtime:
  container_name: realtime-dev.{project-name}-realtime
```

This naming convention is required for Realtime to parse its tenant ID correctly.

📖 **[Realtime Configuration Guide →](docs/REALTIME_CONFIG.md)**

#### 3. Storage with AWS S3

For production deployments, use S3 instead of local file storage:

```bash
# Use AWS configuration with S3
docker-compose -f docker-compose.yml -f docker-compose.aws.yml up -d

# Configure in .env:
STORAGE_BACKEND=s3
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

IAM role permissions required for S3 are documented in `.env.aws.example`.

📖 **[S3 Storage Setup Guide →](docs/STORAGE_S3.md)** *(coming soon)*

### Load Balancer Configuration

When using a load balancer (ALB, nginx, Traefik):

1. **Target Kong port 8000** as the backend
2. **Enable sticky sessions** (required for Realtime WebSocket)
3. **Health check path:** `/` (Kong returns 404, which is expected)
4. **SSL/TLS termination** at load balancer (not in Kong)

#### AWS ALB Example
```
Target Group:
  Protocol: HTTP
  Port: 8000
  Health Check Path: /
  Success Codes: 404
  Stickiness: Enabled (86400 seconds)
```

### Environment Configuration Files

- **`.env.aws.example`** - AWS deployment with RDS, S3, ALB
- **`.env.cloud.example`** - Generic cloud VM deployment *(coming soon)*
- **`docker-compose.aws.yml`** - AWS-specific overrides
- **`docker-compose.cloud.yml`** - Generic cloud overrides *(coming soon)*

### Troubleshooting Cloud Deployments

Common issues and solutions:

#### Load Balancer Health Checks Failing
- **Cause:** Security groups, wrong health check path, or Kong not running
- **Solution:** See [Troubleshooting Guide - Load Balancer Issues](docs/TROUBLESHOOTING.md#load-balancer-issues)

#### Realtime "Tenant not found" Error
- **Cause:** Incorrect container naming
- **Solution:** See [Troubleshooting Guide - Realtime Issues](docs/TROUBLESHOOTING.md#realtime-issues)

#### CORS Errors from Frontend
- **Cause:** Missing or incorrect CORS headers in `kong.yml`
- **Solution:** See [Troubleshooting Guide - CORS Errors](docs/TROUBLESHOOTING.md#cors-errors)

#### S3 Upload Fails
- **Cause:** IAM permissions, bucket policy, or misconfiguration
- **Solution:** See [Troubleshooting Guide - Storage and S3 Issues](docs/TROUBLESHOOTING.md#storage-and-s3-issues)

📖 **[Complete Troubleshooting Guide →](docs/TROUBLESHOOTING.md)**

### Documentation Index

Comprehensive guides for cloud deployment:

#### Core Deployment Guides
- 📘 **[AWS Deployment Guide](docs/AWS_DEPLOYMENT.md)** - Complete AWS setup (EC2, ALB, RDS, S3)
- 📗 **[Cloud VM Deployment](docs/CLOUD_VM_DEPLOYMENT.md)** - DigitalOcean, Linode, etc. *(coming soon)*
- 📙 **[Kubernetes Deployment](docs/KUBERNETES_DEPLOYMENT.md)** - K8s manifests *(coming soon)*
- 📕 **[ECS Deployment](docs/ECS_DEPLOYMENT.md)** - AWS ECS/Fargate *(coming soon)*
- 📓 **[Traefik Setup](docs/TRAEFIK_SETUP.md)** - Traefik reverse proxy *(coming soon)*

#### Configuration Guides
- 📌 **[Port Reference](docs/PORT_REFERENCE.md)** - All service ports and load balancer config
- 🔧 **[Realtime Configuration](docs/REALTIME_CONFIG.md)** - Container naming and WebSocket setup
- 🌐 **[CORS Configuration](docs/CORS_CONFIGURATION.md)** - Multi-origin setup *(coming soon)*
- 💾 **[S3 Storage Setup](docs/STORAGE_S3.md)** - AWS S3 integration *(coming soon)*

#### Operations
- 🔍 **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- 📋 **[Security Checklist](security_checklist.md)** - Security best practices

---

## Additional Notes

- All persistent data and configuration for each deployment is stored under `projects/<project-name>/volumes/`.
- The root directory contains only scripts, templates, and documentation — never secrets.
- For more information on securing your deployment, see `projects/<project-name>/security_checklist.md`.

---

## License

See [LICENSE](LICENSE) for details.
