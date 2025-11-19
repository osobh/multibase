#!/bin/bash

# Multibase Dashboard Status Check Script
# Quick status overview of all services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
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
REDIS_PORT=${DASHBOARD_REDIS_PORT:-6379}
REDIS_CONTAINER="multibase-redis"

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_service() {
    local name=$1
    local check_command=$2
    local details=$3

    echo -n "  $name: "
    if eval "$check_command" &>/dev/null; then
        echo -e "${GREEN}●${NC} Running ${GRAY}$details${NC}"
        return 0
    else
        echo -e "${RED}●${NC} Stopped"
        return 1
    fi
}

# Main status check
print_header "Multibase Dashboard Status"

echo ""
echo -e "${BLUE}Services:${NC}"

RUNNING_COUNT=0
TOTAL_COUNT=0

# Redis
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if docker ps --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
    REDIS_STATUS=$(docker ps --filter "name=${REDIS_CONTAINER}" --format "{{.Status}}")
    echo -e "  Redis:    ${GREEN}●${NC} Running ${GRAY}($REDIS_STATUS)${NC}"
    RUNNING_COUNT=$((RUNNING_COUNT + 1))
else
    echo -e "  Redis:    ${RED}●${NC} Stopped"
fi

# Backend
TOTAL_COUNT=$((TOTAL_COUNT + 1))
BACKEND_PID=""
if [ -f "$PID_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$PID_DIR/backend.pid")
fi

if [ -n "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
    # Check API health
    if API_RESPONSE=$(curl -sf http://localhost:$BACKEND_PORT/api/ping 2>/dev/null); then
        DOCKER_STATUS=$(echo "$API_RESPONSE" | grep -o '"docker":[^,]*' | cut -d: -f2)
        REDIS_STATUS=$(echo "$API_RESPONSE" | grep -o '"redis":[^,]*' | cut -d: -f2)
        echo -e "  Backend:  ${GREEN}●${NC} Running ${GRAY}(PID: $BACKEND_PID, Port: $BACKEND_PORT)${NC}"
        echo -e "            ${GRAY}Docker: $DOCKER_STATUS, Redis: $REDIS_STATUS${NC}"
        RUNNING_COUNT=$((RUNNING_COUNT + 1))
    else
        echo -e "  Backend:  ${YELLOW}●${NC} Starting ${GRAY}(PID: $BACKEND_PID)${NC}"
    fi
else
    echo -e "  Backend:  ${RED}●${NC} Stopped"
fi

# Frontend
TOTAL_COUNT=$((TOTAL_COUNT + 1))
FRONTEND_PID=""
if [ -f "$PID_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
fi

if [ -n "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
    if curl -sf http://localhost:$FRONTEND_PORT &>/dev/null; then
        echo -e "  Frontend: ${GREEN}●${NC} Running ${GRAY}(PID: $FRONTEND_PID, Port: $FRONTEND_PORT)${NC}"
        RUNNING_COUNT=$((RUNNING_COUNT + 1))
    else
        echo -e "  Frontend: ${YELLOW}●${NC} Starting ${GRAY}(PID: $FRONTEND_PID)${NC}"
    fi
else
    echo -e "  Frontend: ${RED}●${NC} Stopped"
fi

# Summary
echo ""
echo -e "${BLUE}Overall Status: ${NC}"
if [ $RUNNING_COUNT -eq $TOTAL_COUNT ]; then
    echo -e "  ${GREEN}✓ All services running ($RUNNING_COUNT/$TOTAL_COUNT)${NC}"
elif [ $RUNNING_COUNT -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Partial ($RUNNING_COUNT/$TOTAL_COUNT services running)${NC}"
else
    echo -e "  ${RED}✗ All services stopped${NC}"
fi

# Port usage
echo ""
echo -e "${BLUE}Port Usage:${NC}"
for port in $REDIS_PORT $BACKEND_PORT $FRONTEND_PORT; do
    if ss -tlnp 2>/dev/null | grep -q ":$port " || netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "  Port $port: ${GREEN}●${NC} In use"
    else
        echo -e "  Port $port: ${GRAY}●${NC} Available"
    fi
done

# Instances (if backend is running)
if [ $RUNNING_COUNT -gt 1 ] && curl -sf http://localhost:$BACKEND_PORT/api/instances &>/dev/null; then
    echo ""
    echo -e "${BLUE}Supabase Instances:${NC}"

    INSTANCES=$(curl -s http://localhost:$BACKEND_PORT/api/instances)
    INSTANCE_COUNT=$(echo "$INSTANCES" | grep -o '"id"' | wc -l)
    HEALTHY_COUNT=$(echo "$INSTANCES" | grep -o '"overall":"healthy"' | wc -l)

    echo -e "  Total:   $INSTANCE_COUNT instances"
    echo -e "  Healthy: ${GREEN}$HEALTHY_COUNT${NC} instances"

    if [ $INSTANCE_COUNT -gt 0 ]; then
        echo ""
        echo -e "  ${GRAY}Instance Details:${NC}"
        echo "$INSTANCES" | grep -o '"name":"[^"]*"' | cut -d: -f2 | tr -d '"' | while read instance; do
            HEALTH=$(echo "$INSTANCES" | grep -A 20 "\"name\":\"$instance\"" | grep -o '"overall":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')
            SERVICES=$(echo "$INSTANCES" | grep -A 20 "\"name\":\"$instance\"" | grep -o '"totalServices":[0-9]*' | head -1 | cut -d: -f2)

            if [ "$HEALTH" = "healthy" ]; then
                echo -e "    • $instance: ${GREEN}●${NC} $HEALTH ${GRAY}($SERVICES services)${NC}"
            elif [ "$HEALTH" = "degraded" ]; then
                echo -e "    • $instance: ${YELLOW}●${NC} $HEALTH ${GRAY}($SERVICES services)${NC}"
            else
                echo -e "    • $instance: ${RED}●${NC} $HEALTH ${GRAY}($SERVICES services)${NC}"
            fi
        done
    fi
fi

# Access URLs
echo ""
echo -e "${BLUE}Access URLs:${NC}"
if [ $RUNNING_COUNT -gt 1 ]; then
    echo -e "  Dashboard: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  API:       ${GREEN}http://localhost:$BACKEND_PORT/api/ping${NC}"
    echo -e "  Nginx:     ${GREEN}http://mission.smartpi.ai${NC} ${GRAY}(when DNS configured)${NC}"
else
    echo -e "  ${GRAY}Services not running${NC}"
fi

# Useful commands
echo ""
echo -e "${BLUE}Commands:${NC}"
echo -e "  Start:  ${YELLOW}./launch.sh${NC}"
echo -e "  Stop:   ${YELLOW}./stop.sh${NC}"
echo -e "  Logs:   ${YELLOW}tail -f backend/logs/backend.log${NC}"
echo ""
