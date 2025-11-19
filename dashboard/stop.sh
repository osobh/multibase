#!/bin/bash

# Multibase Dashboard Stop Script
# Gracefully stops all services with proper cleanup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

# Load port configuration from root .env (with fallback to defaults)
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

BACKEND_PORT=${DASHBOARD_BACKEND_PORT:-3001}
FRONTEND_PORT=${DASHBOARD_FRONTEND_PORT:-5173}
REDIS_CONTAINER="multibase-redis"

# Options
FORCE=false
STOP_REDIS=false
CLEANUP_REDIS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --stop-redis)
            STOP_REDIS=true
            shift
            ;;
        --cleanup-redis)
            STOP_REDIS=true
            CLEANUP_REDIS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force           Use SIGKILL immediately (no graceful shutdown)"
            echo "  --stop-redis      Stop Redis container"
            echo "  --cleanup-redis   Stop and remove Redis container"
            echo "  --help            Show this help message"
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

# Function to gracefully stop a process
stop_process() {
    local pid=$1
    local name=$2
    local timeout=$3

    if ! kill -0 $pid 2>/dev/null; then
        print_warning "$name (PID: $pid) is not running"
        return 0
    fi

    if [ "$FORCE" = true ]; then
        print_info "Force killing $name (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        sleep 1

        if ! kill -0 $pid 2>/dev/null; then
            print_status "$name stopped"
            return 0
        else
            print_error "Failed to kill $name"
            return 1
        fi
    fi

    # Graceful shutdown
    print_info "Stopping $name (PID: $pid)..."
    kill -15 $pid 2>/dev/null || true

    # Wait for process to stop
    local count=0
    while [ $count -lt $timeout ]; do
        if ! kill -0 $pid 2>/dev/null; then
            print_status "$name stopped gracefully"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo ""

    # Process didn't stop, force kill
    print_warning "$name didn't stop gracefully, forcing..."
    kill -9 $pid 2>/dev/null || true
    sleep 1

    if ! kill -0 $pid 2>/dev/null; then
        print_status "$name stopped (forced)"
        return 0
    else
        print_error "Failed to stop $name"
        return 1
    fi
}

# Function to find process by port
find_process_by_port() {
    local port=$1
    # Try multiple methods to find the PID
    local pid=$(lsof -ti:$port 2>/dev/null || ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1 || fuser $port/tcp 2>/dev/null | awk '{print $1}')
    echo "$pid"
}

# Main script
print_header "Multibase Dashboard Shutdown"

STOPPED_SERVICES=0
FAILED_SERVICES=0

# Stop frontend
print_header "Stopping Frontend"

FRONTEND_PID=""
if [ -f "$PID_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
    print_info "Found frontend PID from file: $FRONTEND_PID"
fi

# Fallback: find by port or process name
if [ -z "$FRONTEND_PID" ] || ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_info "Searching for frontend process..."
    # Try to find by port
    FRONTEND_PID=$(find_process_by_port $FRONTEND_PORT)

    # Try to find by process name
    if [ -z "$FRONTEND_PID" ]; then
        FRONTEND_PID=$(pgrep -f "vite.*dev" | head -1)
    fi
fi

if [ -n "$FRONTEND_PID" ]; then
    if stop_process $FRONTEND_PID "Frontend" 5; then
        STOPPED_SERVICES=$((STOPPED_SERVICES + 1))
    else
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
    rm -f "$PID_DIR/frontend.pid"
else
    print_warning "Frontend process not found"
fi

# Stop backend
print_header "Stopping Backend"

BACKEND_PID=""
if [ -f "$PID_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$PID_DIR/backend.pid")
    print_info "Found backend PID from file: $BACKEND_PID"
fi

# Fallback: find by port or process name
if [ -z "$BACKEND_PID" ] || ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_info "Searching for backend process..."
    # Try to find by port
    BACKEND_PID=$(find_process_by_port $BACKEND_PORT)

    # Try to find by process name
    if [ -z "$BACKEND_PID" ]; then
        BACKEND_PID=$(pgrep -f "tsx.*server.ts" | head -1)
    fi
fi

if [ -n "$BACKEND_PID" ]; then
    if stop_process $BACKEND_PID "Backend" 10; then
        STOPPED_SERVICES=$((STOPPED_SERVICES + 1))
    else
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
    rm -f "$PID_DIR/backend.pid"
else
    print_warning "Backend process not found"
fi

# Stop Redis container
if [ "$STOP_REDIS" = true ]; then
    print_header "Stopping Redis"

    if docker ps --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
        print_info "Stopping Redis container..."
        docker stop $REDIS_CONTAINER || true
        print_status "Redis container stopped"
        STOPPED_SERVICES=$((STOPPED_SERVICES + 1))

        if [ "$CLEANUP_REDIS" = true ]; then
            print_info "Removing Redis container..."
            docker rm $REDIS_CONTAINER || true
            print_status "Redis container removed"
        fi
    else
        print_warning "Redis container is not running"
    fi
fi

# Verify ports are freed
print_header "Port Cleanup Verification"

if ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT " || netstat -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT "; then
    print_warning "Port $BACKEND_PORT is still in use"
    if [ "$FORCE" = true ]; then
        fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
        print_status "Port $BACKEND_PORT forcefully freed"
    fi
else
    print_status "Port $BACKEND_PORT is free"
fi

if ss -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT " || netstat -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
    print_warning "Port $FRONTEND_PORT is still in use"
    if [ "$FORCE" = true ]; then
        fuser -k $FRONTEND_PORT/tcp 2>/dev/null || true
        print_status "Port $FRONTEND_PORT forcefully freed"
    fi
else
    print_status "Port $FRONTEND_PORT is free"
fi

# Check for orphaned processes
print_header "Orphaned Process Check"

ORPHANS=$(pgrep -f "tsx.*server.ts|vite.*dev|node.*server.js" | wc -l)
if [ $ORPHANS -gt 0 ]; then
    print_warning "Found $ORPHANS potential orphaned process(es)"
    print_info "Run 'pgrep -af \"tsx|vite\"' to investigate"
else
    print_status "No orphaned processes found"
fi

# Summary
print_header "Shutdown Complete"

echo ""
if [ $STOPPED_SERVICES -gt 0 ]; then
    echo -e "${GREEN}✓ Successfully stopped $STOPPED_SERVICES service(s)${NC}"
fi

if [ $FAILED_SERVICES -gt 0 ]; then
    echo -e "${RED}✗ Failed to stop $FAILED_SERVICES service(s)${NC}"
fi

if [ $STOPPED_SERVICES -eq 0 ] && [ $FAILED_SERVICES -eq 0 ]; then
    echo -e "${YELLOW}⚠ No services were running${NC}"
fi

echo ""
echo -e "${BLUE}Service Status:${NC}"

# Check final status
if docker ps --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
    echo -e "  Redis:    ${GREEN}●${NC} Running"
else
    echo -e "  Redis:    ${RED}●${NC} Stopped"
fi

if pgrep -f "tsx.*server.ts|node.*server.js" > /dev/null; then
    echo -e "  Backend:  ${GREEN}●${NC} Running"
else
    echo -e "  Backend:  ${RED}●${NC} Stopped"
fi

if pgrep -f "vite.*dev" > /dev/null; then
    echo -e "  Frontend: ${GREEN}●${NC} Running"
else
    echo -e "  Frontend: ${RED}●${NC} Stopped"
fi

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  Start services: ${YELLOW}./launch.sh${NC}"
echo -e "  View status:    ${YELLOW}./status.sh${NC}"
echo ""
