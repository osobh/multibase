#!/bin/bash

# Multibase Dashboard Launch Script
# Starts all services in the correct order with health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="$SCRIPT_DIR/.pids"
BACKEND_PORT=3001
FRONTEND_PORT=5173
REDIS_PORT=6379
REDIS_CONTAINER="multibase-redis"

# Options
SKIP_REDIS=false
FORCE_PORTS=false
PRODUCTION=false
FORCE_BUILD=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-redis)
            SKIP_REDIS=true
            shift
            ;;
        --force-ports)
            FORCE_PORTS=true
            shift
            ;;
        --production)
            PRODUCTION=true
            shift
            ;;
        --build)
            FORCE_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-redis     Don't start/check Redis container"
            echo "  --force-ports    Kill processes using required ports"
            echo "  --production     Build and run production versions"
            echo "  --build          Force rebuild before starting"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}✗${NC} Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    return 0
}

check_port() {
    local port=$1
    if ss -tlnp 2>/dev/null | grep -q ":$port " || netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        return 0
    fi
    return 1
}

kill_port() {
    local port=$1
    print_warning "Port $port is in use"

    if [ "$FORCE_PORTS" = true ]; then
        print_info "Killing process on port $port..."
        fuser -k $port/tcp 2>/dev/null || true
        sleep 1
        return 0
    else
        print_error "Use --force-ports to automatically kill the process"
        return 1
    fi
}

wait_for_url() {
    local url=$1
    local max_attempts=$2
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$url" &>/dev/null; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
        echo -n "."
    done
    echo ""
    return 1
}

update_nginx_config() {
    local nginx_conf="/home/osobh/nginx/nginx.conf"
    local nginx_container="nginx_reverse_proxy"

    # Check if nginx config exists
    if [ ! -f "$nginx_conf" ]; then
        print_warning "Nginx config not found at $nginx_conf"
        print_info "Skipping nginx auto-update"
        return 0
    fi

    print_info "Updating nginx configuration with new ports..."

    # Create backup
    cp "$nginx_conf" "$nginx_conf.backup-$(date +%Y%m%d-%H%M%S)" || {
        print_error "Failed to create nginx config backup"
        return 1
    }

    # Update backend upstream port
    sed -i "s|upstream multibase_dashboard_backend {.*server host.docker.internal:[0-9]* |upstream multibase_dashboard_backend {\n        server host.docker.internal:$BACKEND_PORT |" "$nginx_conf"

    # Update frontend upstream port
    sed -i "s|upstream multibase_dashboard_frontend {.*server host.docker.internal:[0-9]* |upstream multibase_dashboard_frontend {\n        server host.docker.internal:$FRONTEND_PORT |" "$nginx_conf"

    # Reload nginx if container is running
    if docker ps --format "{{.Names}}" | grep -q "^${nginx_container}$"; then
        print_info "Reloading nginx configuration..."
        if docker exec $nginx_container nginx -s reload 2>/dev/null; then
            print_status "Nginx configuration updated and reloaded"
        else
            print_warning "Failed to reload nginx (container may not be running)"
        fi
    else
        print_warning "Nginx container not running - config updated but not reloaded"
    fi
}

# Create PID directory
mkdir -p "$PID_DIR"

# Main script
print_header "Multibase Dashboard Launcher"

# Step 1: Pre-flight checks
print_header "Pre-flight Checks"

# Check Node.js
if check_command node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js $NODE_VERSION"
else
    print_error "Node.js is required"
    exit 1
fi

# Check Docker
if check_command docker; then
    if docker info &>/dev/null; then
        print_status "Docker daemon is running"
    else
        print_error "Docker daemon is not accessible"
        exit 1
    fi
else
    print_error "Docker is required"
    exit 1
fi

# Check npm
if check_command npm; then
    print_status "npm is available"
else
    print_error "npm is required"
    exit 1
fi

# Check directories
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

print_status "Directory structure is valid"

# Step 2: Dynamic Port Discovery
print_header "Dynamic Port Discovery"

# Load current port configuration from root .env
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
    print_info "Loaded port configuration from .env"
fi

# Use configured ports or defaults
DESIRED_BACKEND_PORT=${DASHBOARD_BACKEND_PORT:-3001}
DESIRED_FRONTEND_PORT=${DASHBOARD_FRONTEND_PORT:-5173}
DESIRED_REDIS_PORT=${DASHBOARD_REDIS_PORT:-6379}

print_info "Desired ports: Backend=$DESIRED_BACKEND_PORT, Frontend=$DESIRED_FRONTEND_PORT, Redis=$DESIRED_REDIS_PORT"

# Check port availability and find alternatives if needed (sticky port logic)
BACKEND_PORT=$DESIRED_BACKEND_PORT
if node "$SCRIPT_DIR/scripts/check-port.js" $BACKEND_PORT &>/dev/null; then
    print_status "Backend port $BACKEND_PORT is available"
else
    print_warning "Backend port $BACKEND_PORT is in use"
    BACKEND_PORT=$(node "$SCRIPT_DIR/scripts/find-available-port.js" $BACKEND_PORT 50)
    print_info "Found alternative backend port: $BACKEND_PORT"
fi

FRONTEND_PORT=$DESIRED_FRONTEND_PORT
if node "$SCRIPT_DIR/scripts/check-port.js" $FRONTEND_PORT &>/dev/null; then
    print_status "Frontend port $FRONTEND_PORT is available"
else
    print_warning "Frontend port $FRONTEND_PORT is in use"
    FRONTEND_PORT=$(node "$SCRIPT_DIR/scripts/find-available-port.js" $FRONTEND_PORT 50)
    print_info "Found alternative frontend port: $FRONTEND_PORT"
fi

# Redis port discovery - check container existence first
# Note: Docker port mappings are immutable, so we must respect existing containers
if [ "$SKIP_REDIS" = false ]; then
    # Check if Redis container already exists
    if docker ps -a --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
        # Container exists - extract its current port mapping (immutable)
        REDIS_PORT=$(docker inspect $REDIS_CONTAINER \
          --format '{{(index (index .NetworkSettings.Ports "6379/tcp") 0).HostPort}}' \
          2>/dev/null || echo "6379")
        print_info "Found existing Redis container on port $REDIS_PORT"
    else
        # No container exists - do port discovery for new container
        REDIS_PORT=$DESIRED_REDIS_PORT
        if node "$SCRIPT_DIR/scripts/check-port.js" $REDIS_PORT &>/dev/null; then
            print_status "Redis port $REDIS_PORT is available"
        else
            print_warning "Redis port $REDIS_PORT is in use"
            REDIS_PORT=$(node "$SCRIPT_DIR/scripts/find-available-port.js" $REDIS_PORT 50)
            print_info "Found alternative Redis port: $REDIS_PORT"
        fi
    fi
else
    # Redis check skipped - use desired port or default
    REDIS_PORT=${DESIRED_REDIS_PORT:-6379}
fi

# Save discovered ports to root .env for persistence (sticky ports)
cat > "$SCRIPT_DIR/.env" << EOF
# Multibase Dashboard Port Configuration
# These ports are automatically managed by launch.sh
# Edit these values to use different default ports

# Backend API Server Port
DASHBOARD_BACKEND_PORT=$BACKEND_PORT

# Frontend Dev Server Port
DASHBOARD_FRONTEND_PORT=$FRONTEND_PORT

# Redis Container Port
DASHBOARD_REDIS_PORT=$REDIS_PORT

# Last Updated: $(date)
EOF

print_status "Port configuration saved to .env"

# Generate backend .env with discovered ports
cat > "$BACKEND_DIR/.env" << EOF
# Backend Configuration
# Auto-generated by launch.sh from root .env

PORT=$BACKEND_PORT
REDIS_URL=redis://localhost:$REDIS_PORT
CORS_ORIGIN=http://localhost:$FRONTEND_PORT

# Projects
PROJECTS_PATH=/home/osobh/data/multibase/projects

# Database
DATABASE_URL=file:./data/multibase.db

# Logging
LOG_LEVEL=info
EOF

print_status "Backend .env configured with port $BACKEND_PORT"

# Generate frontend .env with discovered ports
cat > "$FRONTEND_DIR/.env" << EOF
# Frontend Configuration
# Auto-generated by launch.sh from root .env

VITE_PORT=$FRONTEND_PORT
VITE_API_URL=http://localhost:$BACKEND_PORT
EOF

print_status "Frontend .env configured with port $FRONTEND_PORT"

# Update nginx configuration with new ports
update_nginx_config

# Step 3: Check dependencies
print_header "Dependency Checks"

# Check backend dependencies
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    print_warning "Backend dependencies not installed"
    print_info "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    npm install || exit 1
    print_status "Backend dependencies installed"
else
    print_status "Backend dependencies are installed"
fi

# Check frontend dependencies
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    print_warning "Frontend dependencies not installed"
    print_info "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install --legacy-peer-deps || exit 1
    print_status "Frontend dependencies installed"
else
    print_status "Frontend dependencies are installed"
fi

# Check Prisma client
cd "$BACKEND_DIR"
if [ ! -d "node_modules/@prisma/client" ] || [ "$FORCE_BUILD" = true ]; then
    print_info "Generating Prisma client..."
    npx prisma generate || exit 1
    print_status "Prisma client generated"
else
    print_status "Prisma client is generated"
fi

# Check database
if [ ! -f "$BACKEND_DIR/data/multibase.db" ]; then
    print_info "Initializing database..."
    npx prisma migrate dev --name init || exit 1
    print_status "Database initialized"
else
    print_status "Database exists"
fi

# Step 4: Redis container
if [ "$SKIP_REDIS" = false ]; then
    print_header "Redis Container"

    # Check if container exists
    if docker ps -a --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
        # Container exists, check if it's running
        if docker ps --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
            print_status "Redis container is already running"
        else
            print_info "Starting existing Redis container..."
            docker start $REDIS_CONTAINER || exit 1
            sleep 2
            print_status "Redis container started"
        fi
    else
        print_info "Creating new Redis container..."
        docker run -d \
            --name $REDIS_CONTAINER \
            -p $REDIS_PORT:6379 \
            --restart unless-stopped \
            redis:alpine || exit 1
        sleep 2
        print_status "Redis container created and started"
    fi

    # Verify Redis is responding
    if redis-cli -h localhost -p $REDIS_PORT ping &>/dev/null; then
        print_status "Redis is responding"
    else
        print_error "Redis is not responding"
        exit 1
    fi
else
    print_info "Skipping Redis container check"
fi


# Step 5: Prepare log directories
print_header "Preparing Directories"

mkdir -p "$BACKEND_DIR/logs"
mkdir -p "$FRONTEND_DIR/logs"
print_status "Log directories created"

# Step 6: Start backend
print_header "Starting Backend API"

cd "$BACKEND_DIR"

if [ "$PRODUCTION" = true ] || [ "$FORCE_BUILD" = true ]; then
    print_info "Building backend..."
    npm run build || exit 1
    print_status "Backend built"

    print_info "Starting backend in production mode..."
    nohup npm start > logs/backend.log 2>&1 &
    BACKEND_PID=$!
else
    print_info "Starting backend in development mode..."
    nohup npm run dev > logs/backend.log 2>&1 &
    BACKEND_PID=$!
fi

echo $BACKEND_PID > "$PID_DIR/backend.pid"
print_info "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
print_info "Waiting for backend to be ready"
echo -n "Checking"
if wait_for_url "http://localhost:$BACKEND_PORT/api/ping" 30; then
    print_status "Backend API is ready"
else
    print_error "Backend failed to start within 30 seconds"
    print_info "Check logs: tail -f $BACKEND_DIR/logs/backend.log"
    exit 1
fi

# Step 7: Start frontend
print_header "Starting Frontend"

cd "$FRONTEND_DIR"

if [ "$PRODUCTION" = true ] || [ "$FORCE_BUILD" = true ]; then
    print_info "Building frontend..."
    npm run build || exit 1
    print_status "Frontend built"

    print_info "Starting frontend in production mode..."
    nohup npx serve -s dist -l $FRONTEND_PORT > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
else
    print_info "Starting frontend in development mode..."
    nohup npm run dev > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
fi

echo $FRONTEND_PID > "$PID_DIR/frontend.pid"
print_info "Frontend PID: $FRONTEND_PID"

# Wait for frontend to be ready
# Note: Vite may auto-select a different port if configured port is in use
print_info "Waiting for frontend to be ready"
echo -n "Checking"

# Give Vite time to start and write to log
sleep 3

# Detect actual port Vite started on from logs
ACTUAL_FRONTEND_PORT=$(grep -oP 'Local:\s+http://localhost:\K\d+' "$FRONTEND_DIR/logs/frontend.log" 2>/dev/null | head -1)

if [ -z "$ACTUAL_FRONTEND_PORT" ]; then
    # Fallback to configured port if detection fails
    ACTUAL_FRONTEND_PORT=$FRONTEND_PORT
    print_warning "Could not detect Vite port from logs, using configured port $FRONTEND_PORT"
else
    if [ "$ACTUAL_FRONTEND_PORT" != "$FRONTEND_PORT" ]; then
        print_warning "Vite started on port $ACTUAL_FRONTEND_PORT (configured: $FRONTEND_PORT)"
    fi
fi

if wait_for_url "http://localhost:$ACTUAL_FRONTEND_PORT" 20; then
    print_status "Frontend is ready on port $ACTUAL_FRONTEND_PORT"
else
    print_error "Frontend failed to start within 20 seconds"
    print_info "Check logs: tail -f $FRONTEND_DIR/logs/frontend.log"
    exit 1
fi

# Step 8: Success summary
print_header "Launch Complete!"

echo ""
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo ""
echo -e "${BLUE}Service Status:${NC}"
echo -e "  Redis:    ${GREEN}●${NC} Running (port $REDIS_PORT)"
echo -e "  Backend:  ${GREEN}●${NC} Running (port $BACKEND_PORT, PID: $BACKEND_PID)"
echo -e "  Frontend: ${GREEN}●${NC} Running (port ${ACTUAL_FRONTEND_PORT:-$FRONTEND_PORT}, PID: $FRONTEND_PID)"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  Dashboard: ${GREEN}http://localhost:${ACTUAL_FRONTEND_PORT:-$FRONTEND_PORT}${NC}"
echo -e "  API:       ${GREEN}http://localhost:$BACKEND_PORT/api/ping${NC}"
echo -e "  Nginx:     ${GREEN}http://mission.smartpi.ai${NC} (when DNS configured)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  Stop services:  ${YELLOW}./stop.sh${NC}"
echo -e "  View status:    ${YELLOW}./status.sh${NC}"
echo -e "  Backend logs:   ${YELLOW}tail -f $BACKEND_DIR/logs/backend.log${NC}"
echo -e "  Frontend logs:  ${YELLOW}tail -f $FRONTEND_DIR/logs/frontend.log${NC}"
echo ""
