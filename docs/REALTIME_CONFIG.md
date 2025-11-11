# Realtime Service Configuration Guide

Deep dive into Supabase Realtime service configuration, container naming, and troubleshooting.

## Table of Contents
- [Understanding Realtime](#understanding-realtime)
- [Critical: Container Naming Convention](#critical-container-naming-convention)
- [Tenant Configuration](#tenant-configuration)
- [WebSocket Configuration](#websocket-configuration)
- [Kong Integration](#kong-integration)
- [Cloud Deployment Considerations](#cloud-deployment-considerations)
- [Troubleshooting](#troubleshooting)

---

## Understanding Realtime

Supabase Realtime provides:
- **Database Changes**: Subscribe to INSERT, UPDATE, DELETE events on PostgreSQL tables
- **Presence**: Track which users are online
- **Broadcast**: Send ephemeral messages between clients
- **Postgres Changes (CDC)**: Listen to row-level changes using PostgreSQL replication

The Realtime service uses WebSocket connections and requires specific configuration in containerized environments.

---

## Critical: Container Naming Convention

### The Naming Pattern

**This is the most important configuration for Realtime to work properly.**

The container name MUST follow this exact pattern:
```
realtime-dev.{project-name}-realtime
```

**Example:**
```yaml
services:
  realtime:
    container_name: realtime-dev.supabase-realtime
    # Breakdown:
    # - "realtime-dev" = Tenant ID (parsed from subdomain)
    # - "." = Required separator
    # - "supabase-realtime" = Project name + service name
```

### Why This Matters

The Realtime service parses its **tenant ID** from the container's hostname by extracting the subdomain:

```
Container name: realtime-dev.supabase-realtime
                    ↓
Parsed tenant ID: realtime-dev
```

This tenant ID is then used to:
1. Look up tenant configuration in the `_realtime.tenants` database table
2. Determine which database to connect to
3. Configure authorization settings

### What Happens If You Get It Wrong

**Incorrect naming examples:**
```yaml
# ❌ Missing subdomain pattern
container_name: supabase-realtime

# ❌ Wrong format
container_name: realtime.supabase

# ❌ No dot separator
container_name: realtime-supabase
```

**Result:** "Tenant not found" error
```
[error] Could not find tenant: undefined
[error] Tenant configuration not found in database
```

### Changing the Tenant ID

If you need a different tenant ID (e.g., for multi-tenancy):

```yaml
realtime:
  container_name: my-tenant.myproject-realtime
  environment:
    # Tenant ID will be parsed as "my-tenant"
```

Then ensure the tenant exists in the database:
```sql
SELECT * FROM _realtime.tenants WHERE name = 'my-tenant';
```

---

## Tenant Configuration

### Database Tables

Realtime uses these tables in the `_realtime` schema:

1. **`_realtime.tenants`** - Tenant configurations
2. **`_realtime.extensions`** - Enabled extensions per tenant

### Viewing Tenant Configuration

```sql
-- Check if tenant exists
SELECT * FROM _realtime.tenants WHERE name = 'realtime-dev';

-- Check tenant extensions
SELECT * FROM _realtime.extensions WHERE tenant_external_id = 'realtime-dev';
```

### Expected Output

```sql
-- _realtime.tenants
 id | name         | external_id  | jwt_secret | ...
----+-------------+--------------+------------+-----
  1 | realtime-dev | realtime-dev | your-jwt   | ...

-- _realtime.extensions
 id | tenant_external_id | type              | settings
----+-------------------+-------------------+---------
  1 | realtime-dev      | postgres_cdc_rls  | {}
  2 | realtime-dev      | broadcast         | {}
  3 | realtime-dev      | presence          | {}
```

### Automatic Initialization

When the Realtime container starts for the first time, it should automatically:
1. Create the tenant entry in `_realtime.tenants`
2. Set up default extensions
3. Configure database replication

This is controlled by the environment variable:
```yaml
environment:
  SEED_SELF_HOST: true  # Enables automatic tenant creation
```

### Manual Tenant Creation

If automatic initialization fails, manually create the tenant:

```sql
-- Create tenant
INSERT INTO _realtime.tenants (name, external_id, jwt_secret, max_concurrent_users, max_events_per_second)
VALUES (
  'realtime-dev',
  'realtime-dev',
  'your-jwt-secret-here',  -- Must match JWT_SECRET from .env
  200,
  100
);

-- Enable extensions
INSERT INTO _realtime.extensions (tenant_external_id, type, settings)
VALUES
  ('realtime-dev', 'postgres_cdc_rls', '{}'),
  ('realtime-dev', 'broadcast', '{}'),
  ('realtime-dev', 'presence', '{}');
```

---

## WebSocket Configuration

### Connection URL Format

Clients connect to Realtime via WebSocket:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-api.com',  // Your Kong/ALB URL
  'your-anon-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 10  // Rate limiting
      }
    }
  }
)

// WebSocket URL is automatically constructed as:
// ws://your-api.com/realtime/v1/websocket?apikey=xxx&vsn=1.0.0
```

### Kong WebSocket Routing

Kong must be configured to handle WebSocket upgrade requests:

```yaml
# In kong.yml
services:
  - name: realtime-v1-ws
    url: http://realtime-dev.supabase-realtime:4000/socket
    protocol: ws  # Important: WebSocket protocol
    routes:
      - name: realtime-v1-ws
        strip_path: true
        paths:
          - /realtime/v1/
    plugins:
      - name: cors
        config:
          headers:
            - sec-websocket-extensions  # Required for WebSocket
            - sec-websocket-key         # Required for WebSocket
            - sec-websocket-version     # Required for WebSocket
      - name: key-auth
```

### Load Balancer Requirements

**Sticky Sessions REQUIRED:**

WebSocket connections must stay on the same backend server for their lifetime.

**AWS ALB:**
```
Target Group Settings:
  ├─ Stickiness: Enabled
  ├─ Stickiness Type: Load balancer generated cookie
  ├─ Duration: 86400 seconds (24 hours)
  └─ Protocol: HTTP (NOT HTTPS, SSL terminates at ALB)
```

**Nginx:**
```nginx
upstream realtime {
  ip_hash;  # Sticky sessions
  server backend1:8000;
  server backend2:8000;
}
```

**Traefik:**
```yaml
labels:
  - "traefik.http.services.supabase.loadbalancer.sticky.cookie=true"
  - "traefik.http.services.supabase.loadbalancer.sticky.cookie.name=supabase_realtime"
```

---

## Kong Integration

### Service Configuration

The Realtime service is exposed through Kong in two ways:

1. **WebSocket endpoint** (`/realtime/v1/` → `ws://`)
2. **HTTP API endpoint** (`/realtime/v1/api` → `http://`)

```yaml
services:
  # WebSocket for client connections
  - name: realtime-v1-ws
    url: http://realtime-dev.supabase-realtime:4000/socket
    protocol: ws
    routes:
      - name: realtime-v1-ws
        paths:
          - /realtime/v1/

  # HTTP API for health checks, metrics, etc.
  - name: realtime-v1-rest
    url: http://realtime-dev.supabase-realtime:4000/api
    protocol: http
    routes:
      - name: realtime-v1-rest
        paths:
          - /realtime/v1/api
```

### Health Check Configuration

Realtime exposes a health check endpoint:

```bash
# Health check URL format
http://realtime:4000/api/tenants/{tenant-id}/health

# Example
curl http://localhost:4000/api/tenants/realtime-dev/health
```

In docker-compose.yml:
```yaml
realtime:
  healthcheck:
    test:
      - "CMD"
      - "curl"
      - "-sSfL"
      - "--head"
      - "-H"
      - "Authorization: Bearer ${ANON_KEY}"
      - "http://localhost:4000/api/tenants/realtime-dev/health"
```

---

## Cloud Deployment Considerations

### DNS Resolution Issues

In cloud environments, Docker's internal DNS may not work reliably. If Kong can't resolve the Realtime container:

**Solution 1: Add dns_search to Kong**
```yaml
kong:
  dns_search: .
  environment:
    KONG_DNS_ORDER: LAST,A,CNAME
```

**Solution 2: Use explicit network**
```yaml
networks:
  supabase_network:
    driver: bridge

services:
  kong:
    networks:
      - supabase_network
  realtime:
    networks:
      - supabase_network
```

### External DNS vs Internal DNS

The Realtime container name is for **internal Docker networking only**. Clients never see this name.

**Client perspective:**
```
Client → https://api.your-domain.com/realtime/v1/websocket
         ↓
         ALB → EC2 → Kong (8000) → Realtime Container
```

**Internal routing:**
```
Kong → realtime-dev.supabase-realtime:4000
```

### Multi-Region Considerations

For multi-region deployments:

1. **Each region has its own Realtime container**
2. **Tenants are per-region** (not shared across regions)
3. **Database replication** required for cross-region subscriptions

Example multi-region setup:
```yaml
# Region 1 (us-east-1)
realtime:
  container_name: realtime-dev.supabase-realtime-east
  environment:
    DB_HOST: east-region-db.example.com

# Region 2 (us-west-1)
realtime:
  container_name: realtime-dev.supabase-realtime-west
  environment:
    DB_HOST: west-region-db.example.com
```

---

## Environment Variables Reference

```yaml
environment:
  # Server
  PORT: 4000

  # Database Connection
  DB_HOST: ${POSTGRES_HOST}
  DB_PORT: ${POSTGRES_PORT}
  DB_USER: supabase_admin
  DB_PASSWORD: ${POSTGRES_PASSWORD}
  DB_NAME: ${POSTGRES_DB}
  DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
  DB_ENC_KEY: supabaserealtime  # Encryption key for sensitive data

  # Authentication
  API_JWT_SECRET: ${JWT_SECRET}  # Must match your JWT_SECRET

  # Application
  SECRET_KEY_BASE: ${SECRET_KEY_BASE}  # Used for session encryption
  APP_NAME: realtime

  # Clustering (single-node setup)
  ERL_AFLAGS: -proto_dist inet_tcp
  DNS_NODES: "''"  # Empty for single node

  # Initialization
  SEED_SELF_HOST: true  # Auto-create tenant on startup
  RUN_JANITOR: true     # Clean up stale connections

  # Rate Limiting
  RLIMIT_NOFILE: "10000"  # Max open file descriptors
```

---

## Troubleshooting

### Issue: "Tenant not found"

**Check these in order:**

1. **Container name is correct:**
   ```bash
   docker ps | grep realtime
   # Should show: realtime-dev.supabase-realtime (or similar)
   ```

2. **Tenant exists in database:**
   ```sql
   SELECT * FROM _realtime.tenants WHERE name = 'realtime-dev';
   ```

3. **SEED_SELF_HOST is enabled:**
   ```bash
   docker exec realtime-dev.supabase-realtime env | grep SEED_SELF_HOST
   # Should show: SEED_SELF_HOST=true
   ```

4. **Check container logs for initialization:**
   ```bash
   docker logs realtime-dev.supabase-realtime | grep -i tenant
   ```

### Issue: WebSocket Connection Immediately Closes

**Possible causes:**

1. **Missing JWT or invalid JWT:**
   ```javascript
   // Ensure you're passing the API key
   const supabase = createClient(url, anonKey)  // ← Must include anon key
   ```

2. **CORS issues:**
   ```yaml
   # Verify CORS headers in kong.yml
   - name: cors
     config:
       headers:
         - sec-websocket-extensions
         - sec-websocket-key
         - sec-websocket-version
   ```

3. **Load balancer not configured for WebSocket:**
   - Enable sticky sessions
   - Increase timeout (websocket connections are long-lived)

### Issue: Database Changes Not Broadcasting

**Check these:**

1. **Logical replication is enabled:**
   ```sql
   SHOW wal_level;
   -- Should return: logical
   ```

2. **Replication slot exists:**
   ```sql
   SELECT * FROM pg_replication_slots WHERE slot_name LIKE 'supabase_realtime%';
   ```

3. **Table has REPLICA IDENTITY:**
   ```sql
   -- Check current setting
   SELECT relname, relreplident FROM pg_class WHERE relname = 'your_table';

   -- Set REPLICA IDENTITY if needed (choose one):
   ALTER TABLE your_table REPLICA IDENTITY DEFAULT;   -- Primary key only
   ALTER TABLE your_table REPLICA IDENTITY FULL;      -- All columns
   ```

4. **RLS policies allow subscription:**
   ```sql
   -- Users can only subscribe to rows they can SELECT
   -- Check SELECT policy on your table
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```

### Issue: High Memory Usage

Realtime is an Elixir application and can use significant memory with many concurrent connections.

**Optimization:**

1. **Limit events per second:**
   ```javascript
   const supabase = createClient(url, key, {
     realtime: {
       params: {
         eventsPerSecond: 10  // Lower if needed
       }
     }
   })
   ```

2. **Limit concurrent connections:**
   ```sql
   UPDATE _realtime.tenants
   SET max_concurrent_users = 100  -- Adjust as needed
   WHERE name = 'realtime-dev';
   ```

3. **Scale horizontally:**
   - Run multiple Realtime instances
   - Use load balancer with sticky sessions

---

## Testing Realtime

### Test WebSocket Connection

```bash
# Install wscat
npm install -g wscat

# Connect to Realtime
wscat -c "ws://localhost:8000/realtime/v1/websocket?apikey=YOUR_ANON_KEY&vsn=1.0.0"

# You should see:
# > Connected
# < {"event":"phx_reply","payload":{"response":{},"status":"ok"},"ref":"1","topic":"phoenix"}
```

### Test Database Subscriptions

```javascript
// Subscribe to table changes
const subscription = supabase
  .channel('public:todos')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'todos' },
    (payload) => {
      console.log('Change received!', payload)
    }
  )
  .subscribe()

// In another terminal, insert a row:
// INSERT INTO todos (task) VALUES ('Test realtime');
```

### Monitoring

```bash
# Check active WebSocket connections
docker exec realtime-dev.supabase-realtime ps aux | grep beam

# Check logs for errors
docker logs realtime-dev.supabase-realtime --tail=100 -f

# Database connections from Realtime
docker exec supabase-db psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE application_name LIKE 'Postgrex%';"
```

---

## Performance Tuning

### Database Connection Pooling

```yaml
# Increase connection pool for high traffic
environment:
  DB_POOL: 10  # Default is 5
```

### Rate Limiting

```sql
-- Adjust per-tenant rate limits
UPDATE _realtime.tenants
SET max_events_per_second = 100  -- Increase if clients hit limits
WHERE name = 'realtime-dev';
```

### Resource Limits

```yaml
# In docker-compose.yml
realtime:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        memory: 512M
```

---

## Related Documentation

- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Solutions to common Realtime issues
- [Port Reference](./PORT_REFERENCE.md) - Realtime ports explained
- [AWS Deployment](./AWS_DEPLOYMENT.md) - ALB sticky session configuration
- [Official Realtime Docs](https://supabase.com/docs/guides/realtime) - Feature documentation
