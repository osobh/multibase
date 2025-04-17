#!/bin/bash
# Secure Supabase Setup Script
# This script automates the process of creating a new secure Supabase deployment

# Display banner
echo "=================================================="
echo "      Secure Supabase Deployment Setup"
echo "=================================================="
echo ""

# Check if project name is provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <project-name> [base-port]"
    echo "Example: $0 my-project 8000"
    exit 1
fi

PROJECT_NAME=$1
BASE_PORT=$2

# Check if supabase_manager.py exists
if [ ! -f "supabase_manager.py" ]; then
    echo "Error: supabase_manager.py not found in the current directory."
    echo "Please run this script from the directory containing the Supabase Deployment Manager files."
    exit 1
fi

# Make scripts executable if they aren't already
chmod +x supabase_manager.py supabase_setup.py update_security.py generate_keys.py

echo "Performing pre-flight checks..."

# Check if project directory already exists
if [ -d "$PROJECT_NAME" ]; then
    echo "Warning: Project directory '$PROJECT_NAME' already exists."
    read -p "Do you want to remove it and create a new one? (y/n): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        echo "Removing existing project directory..."
        rm -rf "$PROJECT_NAME"
    else
        echo "Using existing project directory. Some files may be overwritten."
    fi
fi

echo "Step 1: Creating/updating Supabase project: $PROJECT_NAME"
if [ -z "$BASE_PORT" ]; then
    ./supabase_manager.py create "$PROJECT_NAME" || true
else
    ./supabase_manager.py create "$PROJECT_NAME" --base-port "$BASE_PORT" || true
fi

# Check if project directory exists after creation attempt
if [ ! -d "$PROJECT_NAME" ]; then
    echo "Error: Failed to create project directory."
    exit 1
fi

# Ensure key directories exist
mkdir -p "$PROJECT_NAME/volumes/logs"
mkdir -p "$PROJECT_NAME/volumes/db/data"
mkdir -p "$PROJECT_NAME/volumes/storage"

echo ""
echo "Step 2: Copying initialization files"
# Copy the SQL initialization files to the project
cp _supabase.sql "$PROJECT_NAME/volumes/db/_supabase.sql"
cp init_analytics_schema.sql "$PROJECT_NAME/volumes/db/logs.sql"
echo "Database initialization scripts copied to project."

echo ""
echo "Step 3: Generating secure API keys"
./generate_keys.py --env-file "$PROJECT_NAME/.env"

echo ""
echo "Step 4: Copying security policy examples"
cp sample_security_policies.sql "$PROJECT_NAME/"
echo "Copied sample security policies to $PROJECT_NAME/sample_security_policies.sql"

echo ""
echo "Step 5: Starting Supabase deployment"
# Start all services with Docker Compose
cd "$PROJECT_NAME" && docker compose up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Get port information from the .env file
STUDIO_PORT=$(grep "STUDIO_PORT=" ".env" | cut -d'=' -f2)
KONG_HTTP_PORT=$(grep "KONG_HTTP_PORT=" ".env" | cut -d'=' -f2)
POSTGRES_PORT=$(grep "POSTGRES_PORT=" ".env" | cut -d'=' -f2)

echo ""
echo "=================================================="
echo "      Secure Supabase Deployment Complete!"
echo "=================================================="
echo ""
echo "Your Supabase deployment is now running with enhanced security."
echo ""
echo "Access your deployment at:"
echo "- Studio Dashboard: http://localhost:$STUDIO_PORT"
echo "- API Endpoint: http://localhost:$KONG_HTTP_PORT"
echo "- PostgreSQL: localhost:$POSTGRES_PORT"
echo ""
echo "Security Documentation:"
echo "- Security checklist: $PROJECT_NAME/security_checklist.md"
echo "- Sample security policies: $PROJECT_NAME/sample_security_policies.sql"
echo ""
echo "Next Steps:"
echo "1. Review the security checklist"
echo "2. Apply appropriate Row Level Security policies"
echo "3. Update your client applications with the API keys"
echo ""
echo "To apply the sample security policies (after creating your tables):"
echo "psql -h localhost -p $POSTGRES_PORT -U postgres -d postgres -f $PROJECT_NAME/sample_security_policies.sql"
echo ""
echo "For more information, refer to the README.md file."
echo "=================================================="
