# Port Reference Guide

Complete reference of all service ports in Supabase self-hosted deployment.

## Table of Contents
- [Port Mapping Overview](#port-mapping-overview)
- [Exposed Ports (Host Machine)](#exposed-ports-host-machine)
- [Internal Container Ports](#internal-container-ports)
- [Cloud Load Balancer Configuration](#cloud-load-balancer-configuration)
- [Security Group / Firewall Rules](#security-group--firewall-rules)

---

## Port Mapping Overview

Supabase uses **Kong API Gateway** as the single entry point for all client requests. All client traffic should go through Kong, not directly to individual services.

```
Client → Kong (8000/8443) → Internal Services
```

---

## Exposed Ports (Host Machine)

These ports are accessible from outside the Docker network:

| Service | Default Port | Protocol | Purpose | Configurable Via |
|---------|--------------|----------|---------|------------------|
| **Kong HTTP** | 8000 | HTTP | Main API Gateway (Primary entry point) | `KONG_HTTP_PORT` |
| **Kong HTTPS** | 8443 | HTTPS | API Gateway with TLS | `KONG_HTTPS_PORT` |
| **Studio** | 3000 | HTTP | Supabase Dashboard UI | `STUDIO_PORT` |
| **PostgreSQL** | 5432 | TCP | Direct database access | `POSTGRES_PORT` |
| **Pooler (Supavisor)** | 6543 | TCP | Connection pooler (transaction mode) | `POOLER_PROXY_PORT_TRANSACTION` |
| **Analytics (Logflare)** | 4000 | HTTP | Analytics dashboard | hardcoded |

### Port Usage Guidelines

**For Development (localhost):**
- Expose all ports for easy access
- Kong HTTP: 8000
- Studio: 3000
- Database: 5432

**For Production (Cloud):**
- **Only expose Kong port 8000** through load balancer
- Keep Studio on internal network (access via VPN or bastion host)
- Use external managed database (RDS, CloudSQL) - don't expose 5432
- Use connection pooler (6543) for high-traffic applications

---

## Internal Container Ports

These ports are only accessible within the Docker network and are NOT exposed to the host:

| Service | Internal Port | Protocol | Purpose | Container Name |
|---------|---------------|----------|---------|----------------|
| **Auth (GoTrue)** | 9999 | HTTP | Authentication API | `supabase-auth` |
| **REST (PostgREST)** | 3000 | HTTP | Auto-generated REST API | `supabase-rest` |
| **Realtime** | 4000 | HTTP/WS | Realtime subscriptions & WebSocket | `realtime-dev.supabase-realtime` |
| **Storage** | 5000 | HTTP | File storage API | `supabase-storage` |
| **ImgProxy** | 5001 | HTTP | Image transformation | `supabase-imgproxy` |
| **Meta (pg-meta)** | 8080 | HTTP | Database metadata API | `supabase-meta` |
| **Functions (Edge)** | 9000 | HTTP | Edge Functions runtime | `supabase-edge-functions` |
| **Vector (Logs)** | 9001 | HTTP | Log collection service | `supabase-vector` |
| **Pooler API** | 4000 | HTTP | Pooler health/metrics API | `supabase-pooler` |

> **Important:** Clients should NEVER access these ports directly. All requests must go through Kong (8000/8443).

---

## Cloud Load Balancer Configuration

### AWS Application Load Balancer (ALB)

When deploying on AWS with ALB, use this configuration:

#### Target Group Settings
| Setting | Value | Notes |
|---------|-------|-------|
| **Protocol** | HTTP | SSL terminates at ALB |
| **Port** | 8000 | Kong HTTP port |
| **Target Type** | Instance or IP | Depends on ECS/EC2 setup |
| **VPC** | Your VPC | Same VPC as EC2/ECS |

#### Health Check Configuration
| Setting | Value |
|---------|-------|
| **Protocol** | HTTP |
| **Path** | `/` or `/health` |
| **Port** | 8000 |
| **Success Codes** | 404 or 200 |
| **Interval** | 30 seconds |
| **Timeout** | 5 seconds |
| **Healthy Threshold** | 2 |
| **Unhealthy Threshold** | 3 |

> **Why 404?** Kong returns 404 for the root path `/` when no route matches, which indicates Kong is running properly.

#### Sticky Sessions (Session Affinity)
- **Required** for Realtime WebSocket connections
- Enable "Stickiness" on target group
- Duration: 86400 seconds (24 hours)

#### ALB Listener Configuration
| Port | Protocol | Action |
|------|----------|--------|
| 443 | HTTPS | Forward to target group (Kong:8000) |
| 80 | HTTP | Redirect to HTTPS or forward to target group |

### Google Cloud Load Balancer

| Setting | Value |
|---------|-------|
| **Backend Service Port** | 8000 |
| **Protocol** | HTTP |
| **Health Check Path** | `/` |
| **Session Affinity** | Enable (for WebSockets) |

### Azure Application Gateway

| Setting | Value |
|---------|-------|
| **Backend Pool Port** | 8000 |
| **Protocol** | HTTP |
| **Health Probe Path** | `/` |
| **Cookie-based Affinity** | Enable |

---

## Security Group / Firewall Rules

### AWS Security Groups

#### ALB Security Group
```
Inbound Rules:
- Port 443 from 0.0.0.0/0 (HTTPS from internet)
- Port 80 from 0.0.0.0/0 (HTTP from internet)

Outbound Rules:
- Port 8000 to EC2/ECS Security Group (Kong)
```

#### EC2/ECS Security Group (Application Tier)
```
Inbound Rules:
- Port 8000 from ALB Security Group (Kong API Gateway)
- Port 22 from Bastion SG or your IP (SSH - optional)
- All traffic from self (inter-container communication)

Outbound Rules:
- Port 5432 to RDS Security Group (PostgreSQL)
- Port 443 to 0.0.0.0/0 (HTTPS to internet for external APIs)
- All traffic to self (inter-container communication)
```

#### RDS Security Group (Database Tier)
```
Inbound Rules:
- Port 5432 from EC2/ECS Security Group (PostgreSQL)

Outbound Rules:
- (none required)
```

### DigitalOcean / Linode Firewall

```
Inbound Rules:
- 22/tcp from your_ip (SSH)
- 80/tcp from 0.0.0.0/0 (HTTP)
- 443/tcp from 0.0.0.0/0 (HTTPS)
- 8000/tcp from 0.0.0.0/0 (Kong - if not using reverse proxy)

Outbound Rules:
- Allow all (or specific ports for database, email, etc.)
```

---

## Service-Specific Port Details

### Kong API Gateway (Port 8000/8443)

Kong routes requests to internal services based on URL paths:

| Path | Internal Service | Internal Port |
|------|------------------|---------------|
| `/auth/v1/*` | Auth (GoTrue) | 9999 |
| `/rest/v1/*` | REST (PostgREST) | 3000 |
| `/graphql/v1/*` | GraphQL (PostgREST) | 3000 |
| `/realtime/v1/*` | Realtime | 4000 |
| `/storage/v1/*` | Storage | 5000 |
| `/functions/v1/*` | Functions | 9000 |
| `/pg/*` | Meta (pg-meta) | 8080 |
| `/*` | Studio Dashboard | 3000 |

### Realtime Service (Port 4000)

- **HTTP Endpoints:** `http://realtime:4000/api/*`
- **WebSocket Endpoint:** `ws://realtime:4000/socket/*`
- **Health Check:** `http://realtime:4000/api/tenants/realtime-dev/health`

> **Important:** Realtime WebSocket connections require sticky sessions on your load balancer.

### Studio Dashboard (Port 3000)

- **Access Pattern:** Should only be accessed internally or through VPN
- **Not recommended** to expose directly to internet in production
- Can be accessed through Kong at root path `/`

### Database Pooler (Port 6543)

- **Purpose:** Connection pooling in transaction mode
- **Use Case:** High-traffic applications needing connection pooling
- **Configuration:** See `POOLER_` environment variables

---

## Environment Variable Reference

Configure these in your `.env` file:

```bash
# Kong API Gateway
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# Studio Dashboard
STUDIO_PORT=3000

# PostgreSQL Database
POSTGRES_PORT=5432

# Connection Pooler
POOLER_PROXY_PORT_TRANSACTION=6543
```

---

## Docker Compose Port Mapping Syntax

In `docker-compose.yml`, ports are mapped as:

```yaml
ports:
  - "HOST_PORT:CONTAINER_PORT"
  - "${ENV_VAR}:CONTAINER_PORT"
```

Examples:
```yaml
# Kong
ports:
  - "${KONG_HTTP_PORT}:8000"   # Maps host $KONG_HTTP_PORT to container 8000
  - "${KONG_HTTPS_PORT}:8443"  # Maps host $KONG_HTTPS_PORT to container 8443

# Studio (direct mapping)
ports:
  - "3000:3000"  # Maps host 3000 to container 3000
```

---

## Troubleshooting Port Issues

### "Port already in use" Error

```bash
# Find what's using a port (example: port 8000)
sudo lsof -i :8000

# Or using netstat
netstat -tulpn | grep 8000

# Kill the process using the port
sudo kill -9 PID
```

### Cannot Connect to Service

1. **Check if container is running:**
   ```bash
   docker ps | grep supabase
   ```

2. **Check if port is exposed:**
   ```bash
   docker port supabase-kong
   ```

3. **Test connectivity:**
   ```bash
   # From host machine
   curl http://localhost:8000

   # From inside a container
   docker exec supabase-kong curl http://auth:9999/health
   ```

### Load Balancer Health Check Failing

**Common causes:**
- Health check path is wrong (use `/` for Kong)
- Expected status code is wrong (Kong returns 404 for `/`)
- Security group doesn't allow load balancer → target communication
- Kong container isn't running or is unhealthy

**Solution:**
```bash
# Check Kong logs
docker logs supabase-kong

# Check if Kong is responding
curl -I http://your-server-ip:8000

# Should return HTTP 404 with Kong in the response headers
```

---

## Quick Reference Card

**For Developers (localhost):**
- API: `http://localhost:8000`
- Studio: `http://localhost:3000`
- Database: `postgresql://postgres:postgres@localhost:5432/postgres`

**For Production (AWS ALB example):**
- API: `https://api.your-domain.com` → ALB → Kong:8000
- Studio: Internal only or VPN
- Database: RDS endpoint (not exposed publicly)

**Service Health Checks:**
- Kong: `http://kong:8000/` (returns 404)
- Auth: `http://auth:9999/health`
- Storage: `http://storage:5000/status`
- Realtime: `http://realtime:4000/api/tenants/realtime-dev/health`
- Analytics: `http://analytics:4000/health`

---

## Related Documentation

- [AWS Deployment Guide](./AWS_DEPLOYMENT.md) - Detailed AWS setup with ALB and security groups
- [Cloud VM Deployment Guide](./CLOUD_VM_DEPLOYMENT.md) - Generic cloud VM deployment
- [CORS Configuration Guide](./CORS_CONFIGURATION.md) - Setting up CORS for your domains
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
