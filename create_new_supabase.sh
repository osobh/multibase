#!/bin/bash

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
ANALYTICS_PORT=$((BASE_PORT - 4080))  # Calculate analytics port (8080 → 4000, 8282 → 4202)

echo "Creating new Supabase project: $PROJECT_NAME"
echo "Using base port: $BASE_PORT"
echo "Kong HTTP port: $KONG_HTTP_PORT"
echo "Kong HTTPS port: $KONG_HTTPS_PORT"
echo "Postgres port: $POSTGRES_PORT"
echo "Pooler proxy port: $POOLER_PROXY_PORT"
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
    
    # First, handle the simple format
    sed -i "s/- 4000:4000/- ${analytics_port}:4000/g" "$file"
    
    # Then, handle the extended format with IP addresses
    sed -i "s/0.0.0.0:4000->4000/0.0.0.0:${analytics_port}->4000/g" "$file"
    sed -i "s/\[::]:4000->4000/\[::]:${analytics_port}->4000/g" "$file"
    
    # Check if the replacement was successful
    if grep -q "- ${analytics_port}:4000" "$file"; then
        echo "Successfully updated analytics port to $analytics_port"
    else
        echo "Warning: Failed to update analytics port. Manual review required."
    fi
}

# Copy docker-compose.yml, update project name and container names
if [ -f "docker-compose.yml" ]; then
    echo "Processing docker-compose.yml file to update all container names..."
    
    # Create a temporary file
    cp docker-compose.yml "$PROJECT_NAME/docker-compose.yml.tmp"
    
    # Track if we're inside a ports section
    in_ports_section=false
    
    # Process the file line by line to ensure accurate container name replacements
    while IFS= read -r line; do
        # Check if this line has a container_name definition
        if [[ "$line" == *"container_name:"* ]]; then
            # Extract the service name (the part after supabase-)
            if [[ "$line" == *"realtime-dev.supabase-realtime"* ]]; then
                # Special case for realtime
                new_line="${line/realtime-dev.supabase-realtime/realtime-dev.${PROJECT_NAME}-realtime}"
            else
                # For all regular containers
                service_name=$(echo "$line" | sed -E 's/.*container_name: supabase-([^ ]*).*/\1/')
                new_line="${line/supabase-$service_name/supabase-$service_name-$PROJECT_NAME}"
            fi
            echo "$new_line" >> "$PROJECT_NAME/docker-compose.yml.new"
        else
            # Lines without container_name definitions
            # Update project name
            if [[ "$line" == *"name: supabase"* ]]; then
                echo "name: $PROJECT_NAME" >> "$PROJECT_NAME/docker-compose.yml.new"
            # Special handling for analytics ports (hardcoded at 4000 in default compose file)
            elif [[ "$line" == *"0.0.0.0:4000->4000"* || "$line" == *"\[::]:4000->4000"* ]]; then
                modified_line=$(echo "$line" | sed "s/0.0.0.0:4000->4000/0.0.0.0:$ANALYTICS_PORT->4000/g" | sed "s/\[\:\:\]:4000->4000/\[\:\:\]:$ANALYTICS_PORT->4000/g")
                echo "$modified_line" >> "$PROJECT_NAME/docker-compose.yml.new"
            # Handle port mappings with proper format
            elif [[ "$line" == *"ports:"* ]]; then
                echo "$line" >> "$PROJECT_NAME/docker-compose.yml.new"
                # Flag that we're in the ports section for the next lines
                in_ports_section=true
            elif [[ "$in_ports_section" == true && "$line" == *"\${KONG_HTTP_PORT}:8000"* ]]; then
                # Format the port mapping correctly
                port_line=$(echo "$line" | sed "s/\${KONG_HTTP_PORT}:8000/${KONG_HTTP_PORT}:8000/g")
                formatted_port=$(echo "$port_line" | sed 's/- \(.*\)$/- "\1"/')
                echo "$formatted_port" >> "$PROJECT_NAME/docker-compose.yml.new"
            elif [[ "$in_ports_section" == true && "$line" == *"\${KONG_HTTPS_PORT}:8443"* ]]; then
                # Format the port mapping correctly
                port_line=$(echo "$line" | sed "s/\${KONG_HTTPS_PORT}:8443/${KONG_HTTPS_PORT}:8443/g")
                formatted_port=$(echo "$port_line" | sed 's/- \(.*\)$/- "\1"/')
                echo "$formatted_port" >> "$PROJECT_NAME/docker-compose.yml.new"
            elif [[ "$in_ports_section" == true && "$line" == *"\${POSTGRES_PORT}:5432"* ]]; then
                # Format the port mapping correctly
                port_line=$(echo "$line" | sed "s/\${POSTGRES_PORT}:5432/${POSTGRES_PORT}:5432/g")
                formatted_port=$(echo "$port_line" | sed 's/- \(.*\)$/- "\1"/')
                echo "$formatted_port" >> "$PROJECT_NAME/docker-compose.yml.new"
            elif [[ "$in_ports_section" == true && "$line" == *"\${POOLER_PROXY_PORT_TRANSACTION}:6543"* ]]; then
                # Format the port mapping correctly
                port_line=$(echo "$line" | sed "s/\${POOLER_PROXY_PORT_TRANSACTION}:6543/${POOLER_PROXY_PORT}:6543/g")
                formatted_port=$(echo "$port_line" | sed 's/- \(.*\)$/- "\1"/')
                echo "$formatted_port" >> "$PROJECT_NAME/docker-compose.yml.new"
            # If we're in a ports section but find a line that doesn't have a port mapping,
            # we're exiting the ports section
            elif [[ "$in_ports_section" == true && ! "$line" =~ ^[[:space:]]+- ]]; then
                in_ports_section=false
                echo "$line" >> "$PROJECT_NAME/docker-compose.yml.new"
            # Just copy other lines without changes
            else
                echo "$line" >> "$PROJECT_NAME/docker-compose.yml.new"
            fi
        fi
    done < "$PROJECT_NAME/docker-compose.yml.tmp"
    
    # Replace original file with our modified version
    mv "$PROJECT_NAME/docker-compose.yml.new" "$PROJECT_NAME/docker-compose.yml"
    rm "$PROJECT_NAME/docker-compose.yml.tmp"
    
    echo "Created docker-compose.yml with updated project name, container names, and port mappings"
    
    # Fix analytics port mappings
    fix_analytics_port "$PROJECT_NAME/docker-compose.yml" "$ANALYTICS_PORT"
    
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
    
    # Now update any references to db-config in the services section
    sed -i "s/- db-config:/- ${PROJECT_NAME}_db-config:/g" "$PROJECT_NAME/docker-compose.yml.tmp"
    
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

# Create a reset script
cat > "$PROJECT_NAME/reset.sh" << 'EOL'
#!/bin/bash
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
