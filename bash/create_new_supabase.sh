#!/bin/sh

# Supabase Project Setup Script
# This script creates a new Supabase self-hosted deployment with custom port mappings

# Display usage information if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <project-name> [base-port]"
    echo "  project-name: Name for the new Supabase project (will be used as directory name)"
    echo "  base-port: Optional. Starting port number for port mappings (default: 9000)"
    exit 1
fi

PROJECT_NAME=$1
BASE_PORT=${2:-9000}  # Default to 9000 if not specified

# Calculate derived ports
KONG_HTTP_PORT=$BASE_PORT
KONG_HTTPS_PORT=$((BASE_PORT + 443))
POSTGRES_PORT=$((BASE_PORT + 5432 - 8000))  # Based on default postgres port
POOLER_PROXY_PORT=$((BASE_PORT + 6543 - 8000))  # Based on default pooler port
STUDIO_PORT=$((BASE_PORT + 3000 - 8000))  # For studio
ANALYTICS_PORT=$((BASE_PORT + 4000 - 8000))  # Fixed calculation for analytics port

echo "Creating new Supabase project: $PROJECT_NAME"
echo "Using base port: $BASE_PORT"
echo "Kong HTTP port: $KONG_HTTP_PORT"
echo "Kong HTTPS port: $KONG_HTTPS_PORT"
echo "Postgres port: $POSTGRES_PORT"
echo "Pooler proxy port: $POOLER_PROXY_PORT"
echo "Studio port: $STUDIO_PORT"
echo "Analytics port: $ANALYTICS_PORT"

# Create project directory
if [ -d "$PROJECT_NAME" ]; then
    echo "Error: Directory $PROJECT_NAME already exists. Please choose another name or remove the existing directory."
    exit 1
fi

mkdir -p "$PROJECT_NAME/volumes"
echo "Created directory: $PROJECT_NAME"

# Process analytics port mappings after the initial file processing
fix_analytics_port() {
    local file="$1"
    local analytics_port="$2"
    
    echo "Fixing analytics port mappings in $file..."
    
    # Make a backup
    cp "$file" "${file}.bak"
    
    # Use sed to directly replace the analytics port mappings
    # The formats we need to handle are:
    # 1. "- 4000:4000" (simple format)
    # 2. "- 0.0.0.0:4000:4000/tcp" or similar (extended format)
    
    # First, handle the simple format - fixed the problematic quote characters
    sed -i '' "s/- 4000:4000/- ${analytics_port}:4000/g" "$file"
    
    # Then, handle the extended format with IP addresses
    sed -i '' "s/0.0.0.0:4000->4000/0.0.0.0:${analytics_port}->4000/g" "$file"
    sed -i '' "s/\[\:\:\]:4000->4000/\[\:\:\]:${analytics_port}->4000/g" "$file"
    
    # Check if the replacement was successful using fixed grep pattern
    if grep -q "${analytics_port}:4000" "$file"; then
        echo "Successfully updated analytics port to $analytics_port"
    else
        echo "Warning: Analytics port update may require manual review."
        # Direct port mapping check
        if grep -q "ports:" "$file" && grep -q "4000:4000" "$file"; then
            echo "Found direct port mapping format. Applying alternative fix..."
            sed -i '' "s/      - 4000:4000/      - ${analytics_port}:4000/g" "$file"
        fi
    fi
}

# Fix the docker-compose.yml entries for vector service
fix_vector_docker_socket() {
    local file="$1"
    
    echo "Fixing Vector Docker socket configuration in $file..."
    
    # Make a backup
    cp "$file" "${file}.bak"
    
    # Update the Vector container's socket configuration
    sed -i '' 's|${DOCKER_SOCKET_LOCATION}:/var/run/docker.sock|/var/run/docker.sock:/var/run/docker.sock|g' "$file"
    
    echo "Fixed Vector Docker socket configuration"
}

# Create a modified docker-compose.yml entry for the analytics service
fix_analytics_entry() {
    local file="$1"
    
    echo "Adding custom entrypoint script for analytics in $file..."
    
    # Make a backup
    cp "$file" "${file}.bak"
    
    # Create a custom entrypoint directory
    mkdir -p "$PROJECT_NAME/volumes/analytics"
    
    # Create a custom entrypoint script
    cat > "$PROJECT_NAME/volumes/analytics/entrypoint.sh" << 'EOL'
#!/bin/sh

# Wait for Postgres to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" > /dev/null 2>&1; do
  echo "Postgres is unavailable - sleeping 2s"
  sleep 2
done
echo "PostgreSQL is ready!"

# Try to connect to _supabase database
for i in $(seq 1 10); do
  echo "Attempting to connect to _supabase database (attempt $i/10)..."
  
  if psql -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d _supabase -c '\q' > /dev/null 2>&1; then
    echo "_supabase database exists and is accessible!"
    break
  fi
  
  if [ $i -eq 10 ]; then
    echo "Failed to connect to _supabase database after 10 attempts."
    echo "Creating _supabase database and analytics schema..."
    
    # Create the _supabase database and set up schema
    psql -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d postgres -c '
      CREATE DATABASE _supabase;
    '
    
    psql -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d _supabase -c '
      CREATE SCHEMA _analytics;
      GRANT ALL PRIVILEGES ON DATABASE _supabase TO supabase_admin;
      GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;
    '
    
    echo "Created _supabase database and analytics schema."
  fi
  
  sleep 3
done

# Start the Logflare service
echo "Starting Logflare..."
exec "/app/bin/logflare" "start"
EOL
    
    # Make the script executable
    chmod +x "$PROJECT_NAME/volumes/analytics/entrypoint.sh"
    
    # Update the analytics service to use the custom entrypoint
    sed -i '' -e '/analytics:/,/^[^ ]/ {
      /volumes:/,/^[^ ]/ {
        /volumes:/a\      - ./volumes/analytics/entrypoint.sh:/entrypoint.sh:ro,z
      }
      /command:/d
      /^[ ]*$/a\    command: ["/entrypoint.sh"]
    }' "$file"
    
    echo "Added custom entrypoint script for analytics service"
}

# Copy docker-compose.yml, update project name and container names
if [ -f "docker-compose.yml" ]; then
    echo "Processing docker-compose.yml file to update all container names..."
    
    # Create a temporary file
    cp docker-compose.yml "$PROJECT_NAME/docker-compose.yml"
    
    # Update project name
    sed -i '' "s/name: supabase/name: $PROJECT_NAME/g" "$PROJECT_NAME/docker-compose.yml"
    
    # Update container names
    sed -i '' "s/container_name: supabase-/container_name: $PROJECT_NAME-/g" "$PROJECT_NAME/docker-compose.yml"
    
    # Handle special case for realtime container
    sed -i '' "s/realtime-dev.supabase-realtime/realtime-dev.$PROJECT_NAME-realtime/g" "$PROJECT_NAME/docker-compose.yml"
    
    # Update port mappings
    sed -i '' "s/\${KONG_HTTP_PORT}:8000/$KONG_HTTP_PORT:8000/g" "$PROJECT_NAME/docker-compose.yml"
    sed -i '' "s/\${KONG_HTTPS_PORT}:8443/$KONG_HTTPS_PORT:8443/g" "$PROJECT_NAME/docker-compose.yml"
    sed -i '' "s/\${POSTGRES_PORT}:5432/$POSTGRES_PORT:5432/g" "$PROJECT_NAME/docker-compose.yml"
    sed -i '' "s/\${POOLER_PROXY_PORT_TRANSACTION}:6543/$POOLER_PROXY_PORT:6543/g" "$PROJECT_NAME/docker-compose.yml"
    sed -i '' "s/- 4000:4000/- $ANALYTICS_PORT:4000/g" "$PROJECT_NAME/docker-compose.yml"
    
    echo "Created docker-compose.yml with updated project name, container names, and port mappings"
    
    # Fix analytics port mappings
    fix_analytics_port "$PROJECT_NAME/docker-compose.yml" "$ANALYTICS_PORT"
    
    # Fix Vector Docker socket configuration
    fix_vector_docker_socket "$PROJECT_NAME/docker-compose.yml"
    
    # Fix analytics container entry point
    fix_analytics_entry "$PROJECT_NAME/docker-compose.yml"
    
    # Add volumes section to ensure uniqueness
    if grep -q "volumes:" "$PROJECT_NAME/docker-compose.yml"; then
        # Make a backup of the file
        cp "$PROJECT_NAME/docker-compose.yml" "$PROJECT_NAME/docker-compose.yml.bak"
        
        # Use awk to process the volumes section
        awk -v proj="$PROJECT_NAME" '
        /^volumes:/ {
            print;
            in_volumes = 1;
            next;
        }
        
        in_volumes && /^[a-zA-Z]/ {
            in_volumes = 0;
        }
        
        in_volumes && /^ *db-config:/ {
            print "  " proj "_db-config:";
            next;
        }
        
        { print }
        ' "$PROJECT_NAME/docker-compose.yml.bak" > "$PROJECT_NAME/docker-compose.yml"
        
        # Remove backup
        rm "$PROJECT_NAME/docker-compose.yml.bak"
        echo "Updated volumes section in docker-compose.yml"
    fi
else
    echo "Warning: docker-compose.yml not found in current directory"
fi

# Fix the volumes section more thoroughly to handle the db-config volume issue
if grep -q "volumes:" "$PROJECT_NAME/docker-compose.yml"; then
    echo "Fixing volume references in docker-compose.yml..."
    
    # Make a backup of the file
    cp "$PROJECT_NAME/docker-compose.yml" "$PROJECT_NAME/docker-compose.yml.bak"
    
    # Check if we've already processed the volumes section in the earlier step
    if ! grep -q "${PROJECT_NAME}_db-config:" "$PROJECT_NAME/docker-compose.yml"; then
        # First, update the volumes section at the end of the file
        awk -v proj="$PROJECT_NAME" '
        /^volumes:/ {
            print "volumes:";
            print "  " proj "_db-config:";
            in_volumes = 1;
            next;
        }
        
        in_volumes && /^ *db-config:/ {
            # Skip this line as we already printed the replacement
            next;
        }
        
        in_volumes && /^[^ ]/ {
            # Not indented - we are out of the volumes section
            in_volumes = 0;
            print;
            next;
        }
        
        # Print all other lines unchanged
        { print }
        ' "$PROJECT_NAME/docker-compose.yml.bak" > "$PROJECT_NAME/docker-compose.yml.tmp"
    else
        # Just copy the file if we've already processed the volumes section
        cp "$PROJECT_NAME/docker-compose.yml.bak" "$PROJECT_NAME/docker-compose.yml.tmp"
    fi
    
    # Now update any references to db-config in the services section
    sed -i '' "s/- db-config:/- ${PROJECT_NAME}_db-config:/g" "$PROJECT_NAME/docker-compose.yml.tmp"
    
    # Move the temporary file to the final location
    mv "$PROJECT_NAME/docker-compose.yml.tmp" "$PROJECT_NAME/docker-compose.yml"
    rm "$PROJECT_NAME/docker-compose.yml.bak"
    
    echo "Updated volume references in docker-compose.yml"
fi

# Copy .env file and update port values
if [ -f ".env" ]; then
    sed -e "s/KONG_HTTP_PORT=.*/KONG_HTTP_PORT=${KONG_HTTP_PORT}/g" \
        -e "s/KONG_HTTPS_PORT=.*/KONG_HTTPS_PORT=${KONG_HTTPS_PORT}/g" \
        -e "s/POSTGRES_PORT=.*/POSTGRES_PORT=${POSTGRES_PORT}/g" \
        -e "s/POOLER_PROXY_PORT_TRANSACTION=.*/POOLER_PROXY_PORT_TRANSACTION=${POOLER_PROXY_PORT}/g" \
        -e "s/STUDIO_PORT=.*/STUDIO_PORT=${STUDIO_PORT}/g" \
        -e "s/SUPABASE_PUBLIC_URL=http:\/\/localhost:8000/SUPABASE_PUBLIC_URL=http:\/\/localhost:${KONG_HTTP_PORT}/g" \
        -e "s/SITE_URL=http:\/\/localhost:3000/SITE_URL=http:\/\/localhost:${STUDIO_PORT}/g" \
        -e "s/API_EXTERNAL_URL=http:\/\/localhost:8000/API_EXTERNAL_URL=http:\/\/localhost:${KONG_HTTP_PORT}/g" \
        -e "s/DASHBOARD_PASSWORD=.*/DASHBOARD_PASSWORD=${PROJECT_NAME}/g" \
        -e "s/STUDIO_DEFAULT_ORGANIZATION=.*/STUDIO_DEFAULT_ORGANIZATION=\"${PROJECT_NAME}\"/g" \
        -e "s/STUDIO_DEFAULT_PROJECT=.*/STUDIO_DEFAULT_PROJECT=\"${PROJECT_NAME}\"/g" \
        .env > "$PROJECT_NAME/.env"
    echo "Created .env with updated port configurations"
else
    echo "Warning: .env file not found in current directory. Creating from the provided example."
    cat > "$PROJECT_NAME/.env" << EOL
############
# Secrets
# YOU MUST CHANGE THESE BEFORE GOING INTO PRODUCTION
############
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=${PROJECT_NAME}
SECRET_KEY_BASE=UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq
VAULT_ENC_KEY=your-encryption-key-32-chars-min
############
# Database - You can change these to any PostgreSQL database that has logical replication enabled.
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=${POSTGRES_PORT}
# default user is postgres
############
# Supavisor -- Database pooler
############
POOLER_PROXY_PORT_TRANSACTION=${POOLER_PROXY_PORT}
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=your-tenant-id
############
# API Proxy - Configuration for the Kong Reverse proxy.
############
KONG_HTTP_PORT=${KONG_HTTP_PORT}
KONG_HTTPS_PORT=${KONG_HTTPS_PORT}
############
# API - Configuration for PostgREST.
############
PGRST_DB_SCHEMAS=public,storage,graphql_public
############
# Auth - Configuration for the GoTrue authentication server.
############
## General
SITE_URL=http://localhost:${STUDIO_PORT}
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://localhost:${KONG_HTTP_PORT}
## Mailer Config
MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"
## Email auth
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender
ENABLE_ANONYMOUS_USERS=false
## Phone auth
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true
############
# Studio - Configuration for the Dashboard
############
STUDIO_DEFAULT_ORGANIZATION="${PROJECT_NAME}"
STUDIO_DEFAULT_PROJECT="${PROJECT_NAME}"
STUDIO_PORT=${STUDIO_PORT}
# replace if you intend to use Studio outside of localhost
SUPABASE_PUBLIC_URL=http://localhost:${KONG_HTTP_PORT}
# Enable webp support
IMGPROXY_ENABLE_WEBP_DETECTION=true
# Add your OpenAI API key to enable SQL Editor Assistant
OPENAI_API_KEY=
############
# Functions - Configuration for Functions
############
# NOTE: VERIFY_JWT applies to all functions. Per-function VERIFY_JWT is not supported yet.
FUNCTIONS_VERIFY_JWT=false
############
# Logs - Configuration for Logflare
# Please refer to https://supabase.com/docs/reference/self-hosting-analytics/introduction
############
LOGFLARE_LOGGER_BACKEND_API_KEY=your-super-secret-and-long-logflare-key
# Change vector.toml sinks to reflect this change
LOGFLARE_API_KEY=your-super-secret-and-long-logflare-key
# Docker socket location - this value will differ depending on your OS
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
# Google Cloud Project details
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER
EOL
fi

# Copy volumes directory
if [ -d "volumes" ]; then
    # Create subdirectories first
    mkdir -p "$PROJECT_NAME/volumes/logs"
    mkdir -p "$PROJECT_NAME/volumes/api"
    mkdir -p "$PROJECT_NAME/volumes/storage/stub"
    mkdir -p "$PROJECT_NAME/volumes/pooler"
    mkdir -p "$PROJECT_NAME/volumes/db/init"
    mkdir -p "$PROJECT_NAME/volumes/db/data"
    mkdir -p "$PROJECT_NAME/volumes/functions/main"
    mkdir -p "$PROJECT_NAME/volumes/functions/hello"
    
    # Copy files
    if [ -f "volumes/logs/vector.yml" ]; then
        cp "volumes/logs/vector.yml" "$PROJECT_NAME/volumes/logs/"
    fi
    
    if [ -f "volumes/api/kong.yml" ]; then
        cp "volumes/api/kong.yml" "$PROJECT_NAME/volumes/api/"
    fi
    
    if [ -f "volumes/pooler/pooler.exs" ]; then
        cp "volumes/pooler/pooler.exs" "$PROJECT_NAME/volumes/pooler/"
    fi
    
    # Copy DB files
    for file in volumes/db/*.sql; do
        if [ -f "$file" ]; then
            cp "$file" "$PROJECT_NAME/volumes/db/"
        fi
    done
    
    if [ -f "volumes/db/init/data.sql" ]; then
        cp "volumes/db/init/data.sql" "$PROJECT_NAME/volumes/db/init/"
    fi
    
    # Copy function files
    if [ -f "volumes/functions/main/index.ts" ]; then
        cp "volumes/functions/main/index.ts" "$PROJECT_NAME/volumes/functions/main/"
    fi
    
    if [ -f "volumes/functions/hello/index.ts" ]; then
        cp "volumes/functions/hello/index.ts" "$PROJECT_NAME/volumes/functions/hello/"
    fi
    
    echo "Copied volumes directory structure and files"
else
    echo "Warning: volumes directory not found in current directory"
    # Create basic structure for volumes
    mkdir -p "$PROJECT_NAME/volumes/logs"
    mkdir -p "$PROJECT_NAME/volumes/api"
    mkdir -p "$PROJECT_NAME/volumes/storage"
    mkdir -p "$PROJECT_NAME/volumes/pooler"
    mkdir -p "$PROJECT_NAME/volumes/db"
    mkdir -p "$PROJECT_NAME/volumes/functions/main"
    echo "Created basic volumes directory structure"
fi

# Create default vector.yml configuration file if it doesn't exist
if [ ! -f "$PROJECT_NAME/volumes/logs/vector.yml" ]; then
    echo "Creating default vector.yml configuration file..."
    cat > "$PROJECT_NAME/volumes/logs/vector.yml" << EOL
# Default Vector configuration for Supabase
api:
  enabled: true
  address: 0.0.0.0:9001

# Data sources
sources:
  docker_syslog:
    type: docker_logs
    docker_host: unix:///var/run/docker.sock  # Hardcoded path instead of using environment variable

# Data transformations
transforms:
  parse_logs:
    type: remap
    inputs:
      - docker_syslog
    source: |
      # Simply store the message and metadata
      .parsed = .message
      .container_name = .container_name
      .timestamp = .timestamp

# Data destinations
sinks:
  console:
    type: console
    inputs:
      - parse_logs
    encoding:
      codec: json

  analytics:
    type: http
    inputs:
      - parse_logs
    encoding:
      codec: json
    uri: http://analytics:4000/api/logs
    method: post
    auth:
      strategy: bearer
      token: "\${LOGFLARE_API_KEY}"
    request:
      headers:
        Content-Type: application/json
EOL
    echo "Created default vector.yml configuration"
fi

# Create a default Kong configuration if it doesn't exist
if [ ! -f "$PROJECT_NAME/volumes/api/kong.yml" ]; then
    echo "Creating default Kong configuration file..."
    cat > "$PROJECT_NAME/volumes/api/kong.yml" << EOL
_format_version: "2.1"
_transform: true

services:
  - name: auth-v1
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-route
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors
  - name: auth-v1-admin
    url: http://auth:9999/admin
    routes:
      - name: auth-v1-admin-route
        paths:
          - /auth/v1/admin
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
  - name: rest
    url: http://rest:3000
    routes:
      - name: rest-route
        paths:
          - /rest/v1
    plugins:
      - name: cors
  - name: postgrest
    url: http://rest:3000
    routes:
      - name: postgrest-route
        paths:
          - /
        strip_path: false
    plugins:
      - name: cors
  - name: realtime
    url: http://realtime:4000/socket/
    routes:
      - name: realtime-route
        paths:
          - /realtime/v1
        strip_path: true
    plugins:
      - name: cors
  - name: storage
    url: http://storage:5000
    routes:
      - name: storage-route
        paths:
          - /storage/v1
    plugins:
      - name: cors
  - name: meta
    url: http://meta:8080
    routes:
      - name: meta-route
        paths:
          - /pg
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
  - name: functions
    url: http://functions:9000
    routes:
      - name: functions-route
        paths:
          - /functions/v1
    plugins:
      - name: cors

consumers:
  - username: anonymous
    keyauth_credentials:
      - key: {{ SUPABASE_ANON_KEY }}
  - username: service_role
    keyauth_credentials:
      - key: {{ SUPABASE_SERVICE_KEY }}
    acls:
      - group: admin
  - username: dashboard
    basicauth_credentials:
      - username: {{ DASHBOARD_USERNAME }}
        password: {{ DASHBOARD_PASSWORD }}
    acls:
      - group: admin
EOL
    echo "Created default Kong configuration"
fi

# Create default pooler.exs file if it doesn't exist
if [ ! -f "$PROJECT_NAME/volumes/pooler/pooler.exs" ]; then
    echo "Creating default pooler.exs configuration..."
    cat > "$PROJECT_NAME/volumes/pooler/pooler.exs" << EOL
alias Supavisor.Config
alias Supavisor.Config.User

Config.set_tenant_id("${POOLER_TENANT_ID}")

user = %User{
  username: "postgres",
  password: "postgres",
  pool_size: "${POOLER_DEFAULT_POOL_SIZE}",
  pool_checkout_timeout: 1000,
  check_query: "select 1",
  max_client_conn: "${POOLER_MAX_CLIENT_CONN}",
  ip_version: 4,
  only_proxies: false,
  admin: true
}

%{cluster_name: "local", host: "db", port: "${POSTGRES_PORT}", database: "postgres", maintenance_db: "${POSTGRES_DB}"}
|> Config.ensure_cluster!()
|> Config.ensure_user!(user)
EOL
    echo "Created default pooler.exs configuration"
fi

# Create a basic function file if it doesn't exist
if [ ! -f "$PROJECT_NAME/volumes/functions/main/index.ts" ]; then
    echo "Creating default function file..."
    mkdir -p "$PROJECT_NAME/volumes/functions/main"
    cat > "$PROJECT_NAME/volumes/functions/main/index.ts" << EOL
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

console.log("Hello from Functions!");

serve(async (req) => {
  const { name } = await req.json();
  const data = {
    message: \`Hello \${name}!\`,
  };

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});
EOL
    echo "Created default function file"
fi

# Create an example Hello function
if [ ! -f "$PROJECT_NAME/volumes/functions/hello/index.ts" ]; then
    echo "Creating example hello function..."
    mkdir -p "$PROJECT_NAME/volumes/functions/hello"
    cat > "$PROJECT_NAME/volumes/functions/hello/index.ts" << EOL
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

console.log("Hello from Functions!");

serve(async (req) => {
  const { name } = await req.json();
  const data = {
    message: \`Hello \${name || "World"}!\`,
    timestamp: new Date().toISOString(),
    projectName: "$PROJECT_NAME",
  };

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});
EOL
    echo "Created example hello function"
fi

# Create a basic _supabase.sql setup script if it doesn't exist
if [ ! -f "$PROJECT_NAME/volumes/db/_supabase.sql" ]; then
    echo "Creating basic _supabase database initialization script..."
    cat > "$PROJECT_NAME/volumes/db/_supabase.sql" << EOL
-- Create the _supabase database if it doesn't exist
CREATE DATABASE IF NOT EXISTS _supabase;
\\c _supabase;

-- Create the _analytics schema
CREATE SCHEMA IF NOT EXISTS _analytics;

-- Set up permissions
GRANT ALL PRIVILEGES ON DATABASE _supabase TO supabase_admin;
GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;
EOL
    echo "Created _supabase.sql initialization script"
fi

# Create a basic initialization script for database setup
if [ ! -f "$PROJECT_NAME/volumes/db/init/setup.sql" ]; then
    echo "Creating database initialization script..."
    mkdir -p "$PROJECT_NAME/volumes/db/init"
    cat > "$PROJECT_NAME/volumes/db/init/setup.sql" << EOL
-- Create the _supabase database
CREATE DATABASE _supabase;

-- Connect to the _supabase database
\\c _supabase;

-- Create the _analytics schema
CREATE SCHEMA _analytics;

-- Grant privileges to supabase_admin
GRANT ALL PRIVILEGES ON DATABASE _supabase TO supabase_admin;
GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;
EOL
    echo "Created database initialization script"
fi

# Create logs.sql file with required tables for analytics
if [ ! -f "$PROJECT_NAME/volumes/db/logs.sql" ]; then
    echo "Creating logs.sql for analytics..."
    cat > "$PROJECT_NAME/volumes/db/logs.sql" << EOL
-- Connect to the _supabase database
\\c _supabase;

-- Switch to the _analytics schema
SET search_path TO _analytics;

-- Create tables required for Logflare/analytics if they don't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);

CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    token text NOT NULL UNIQUE,
    public boolean DEFAULT false,
    metrics jsonb,
    user_id integer,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS source_schemas (
    id SERIAL PRIMARY KEY,
    source_id integer REFERENCES sources (id) ON DELETE CASCADE,
    schema jsonb,
    bigquery_schema jsonb,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);

-- Add more tables as needed for the analytics system

-- Ensure proper permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA _analytics TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA _analytics TO supabase_admin;
EOL
    echo "Created logs.sql for analytics"
fi

# Create a reset script
cat > "$PROJECT_NAME/reset.sh" << 'EOL'
#!/bin/sh
# Reset script for Supabase project

echo "Stopping all containers..."
docker compose down -v --remove-orphans

echo "Removing database data..."
rm -rf ./volumes/db/data

echo "Recreating database data directory..."
mkdir -p ./volumes/db/data

echo "Reset complete. You can now start the project with: docker compose up"
EOL

chmod +x "$PROJECT_NAME/reset.sh"
echo "Created reset.sh script"

# Create a simplified docker-compose.override.yml that only defines the network
cat > "$PROJECT_NAME/docker-compose.override.yml" << EOL
# Override file for ${PROJECT_NAME} Supabase deployment
# This ensures networks are isolated

name: ${PROJECT_NAME}

networks:
  default:
    name: ${PROJECT_NAME}-network
EOL

echo "Created docker-compose.override.yml for network isolation"

# Create README.md with instructions
cat > "$PROJECT_NAME/README.md" << EOL
# Supabase Project: $PROJECT_NAME

This is a self-hosted Supabase deployment with custom port configurations.

## Port Configuration

- Kong HTTP API: $KONG_HTTP_PORT
- Kong HTTPS API: $KONG_HTTPS_PORT
- PostgreSQL: $POSTGRES_PORT
- Pooler (Connection Pooler): $POOLER_PROXY_PORT
- Studio Dashboard: $STUDIO_PORT
- Analytics: $ANALYTICS_PORT

## Getting Started

1. Start the services:
   \`\`\`
   docker compose up -d
   \`\`\`

2. Access the Studio dashboard at:
   \`\`\`
   http://localhost:$STUDIO_PORT
   \`\`\`

3. API endpoint is available at:
   \`\`\`
   http://localhost:$KONG_HTTP_PORT
   \`\`\`

4. To connect to the database directly:
   \`\`\`
   psql -h localhost -p $POSTGRES_PORT -U postgres
   \`\`\`

## Reset Environment

To reset the environment and start fresh:
\`\`\`
./reset.sh
\`\`\`

## Service Health

You can check the health of your services with:
\`\`\`
docker compose ps
\`\`\`
EOL

echo "Created README.md with instructions"

echo
echo "Supabase project '$PROJECT_NAME' has been successfully created."
echo "To start the services, run the following commands:"
echo "  cd $PROJECT_NAME"
echo "  docker compose up -d"
echo
echo "You'll be able to access:"
echo "  - Studio dashboard: http://localhost:$STUDIO_PORT"
echo "  - API endpoint: http://localhost:$KONG_HTTP_PORT"
echo "  - PostgreSQL on port: $POSTGRES_PORT"
echo "  - Analytics on port: $ANALYTICS_PORT"
echo
echo "Login credentials:"
echo "  Username: supabase"
echo "  Password: ${PROJECT_NAME}"
echo
echo "For more information, see README.md in the project directory."
