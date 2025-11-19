# Multibase Dashboard

A comprehensive web-based management interface for monitoring and controlling multiple Supabase instances running via Docker.

## Overview

The Multibase Dashboard provides a unified interface to:
- View all Supabase instances at a glance
- Monitor health status in real-time
- Track resource usage (CPU, memory, disk, network)
- View and stream logs from all services
- Create, start, stop, and delete instances
- Manage credentials and API keys
- Configure alerts and notifications

## Architecture

```
dashboard/
├── backend/          # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── services/     # Core services (Docker, Instance, Health, Metrics)
│   │   ├── routes/       # REST API endpoints
│   │   ├── utils/        # Utilities (logger, env parser, key generator)
│   │   └── server.ts     # Main Express + Socket.io server
│   └── prisma/           # SQLite database schema
│
└── frontend/         # React 19.2 + Vite + TypeScript
    └── src/
        ├── components/   # UI components
        ├── pages/        # Page components
        ├── hooks/        # Custom React hooks
        └── lib/          # API client & utilities
```

## Tech Stack

### Backend
- **Node.js 20+** with TypeScript
- **Express** - REST API framework
- **Socket.io** - Real-time WebSocket communication
- **Prisma** + **SQLite** - Database ORM and storage
- **Redis** - Caching layer
- **dockerode** - Docker API integration

### Frontend
- **React 19.2** with TypeScript
- **Vite** - Build tool and dev server
- **TailwindCSS** + **shadcn/ui** - Styling and components
- **Recharts** - Data visualization
- **React Query** - Data fetching and caching
- **Socket.io-client** - Real-time updates

## Prerequisites

- Node.js 20+ and npm/yarn
- Docker and Docker Compose
- Redis (can run in Docker)
- Git

## Installation

### 1. Clone or Navigate to the Repository

```bash
cd /home/osobh/data/multibase/dashboard
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Generate Prisma client and create database
npx prisma generate
npx prisma migrate dev --name init

# Build TypeScript
npm run build

# Start the backend
npm run dev
```

The backend will run on **http://localhost:3001**

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will run on **http://localhost:5173**

### 4. Start Redis (if not already running)

```bash
# Option 1: Docker
docker run -d -p 6379:6379 redis:alpine

# Option 2: System service (if installed)
sudo systemctl start redis
```

## Configuration

### Backend Environment Variables

Edit `backend/.env`:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="file:./data/multibase.db"

# Redis
REDIS_URL=redis://localhost:6379

# Docker
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Multibase Projects
PROJECTS_PATH=../../projects

# CORS
CORS_ORIGIN=http://localhost:5173

# Intervals (milliseconds)
METRICS_INTERVAL=15000        # Collect metrics every 15 seconds
HEALTH_CHECK_INTERVAL=10000   # Check health every 10 seconds
```

## API Endpoints

### Instances

```
GET    /api/instances                      # List all instances
GET    /api/instances/:name                # Get instance details
POST   /api/instances                      # Create new instance
DELETE /api/instances/:name                # Delete instance
POST   /api/instances/:name/start          # Start instance
POST   /api/instances/:name/stop           # Stop instance
POST   /api/instances/:name/restart        # Restart instance
PUT    /api/instances/:name/credentials    # Update credentials
GET    /api/instances/:name/services       # Get service status
POST   /api/instances/:name/services/:service/restart  # Restart service
```

### Health

```
GET  /api/health/instances/:name          # Get health status
POST /api/health/instances/:name/refresh  # Force health refresh
```

### Metrics

```
GET  /api/metrics/system                    # System-wide metrics
GET  /api/metrics/instances/:name           # Latest instance metrics
GET  /api/metrics/instances/:name/history   # Historical metrics
GET  /api/metrics/instances/:name/services/:service  # Service metrics
```

### Logs

```
GET  /api/logs/instances/:name              # All instance logs
GET  /api/logs/instances/:name/services/:service  # Service logs
```

### System

```
GET  /api/ping                              # Dashboard health check
```

## WebSocket Events

### Client → Server

```javascript
// Subscribe to log streaming
socket.emit('logs:subscribe', {
  instanceName: 'popupcash',
  serviceName: 'kong'
});

// Unsubscribe from logs
socket.emit('logs:unsubscribe');
```

### Server → Client

```javascript
// Instance list
socket.on('instances:list', (instances) => {});

// Health status changed
socket.on('health:update', (event) => {});

// Metrics updated
socket.on('metrics:update', (metrics) => {});

// Alert triggered
socket.on('alert:triggered', (alert) => {});

// Log data (when subscribed)
socket.on('logs:data', (data) => {});
```

## Usage Examples

### Create a New Instance

**via API:**
```bash
curl -X POST http://localhost:3001/api/instances \
  -H "Content-Type: application/json" \
  -d '{
    "name": "myproject",
    "deploymentType": "localhost",
    "basePort": 5000,
    "corsOrigins": ["http://localhost:3000"]
  }'
```

**via Dashboard:**
1. Click "+ Create Instance" button
2. Fill in the form:
   - Name: myproject
   - Deployment Type: Localhost
   - Base Port: 5000 (optional, auto-assigns if empty)
   - CORS Origins: http://localhost:3000
3. Click "Create"

### Start/Stop an Instance

**via API:**
```bash
# Start
curl -X POST http://localhost:3001/api/instances/myproject/start

# Stop
curl -X POST http://localhost:3001/api/instances/myproject/stop

# Restart
curl -X POST http://localhost:3001/api/instances/myproject/restart
```

**via Dashboard:**
- Click the instance card
- Use the Start/Stop/Restart buttons

### View Logs

**via API:**
```bash
# Get recent logs
curl http://localhost:3001/api/logs/instances/myproject/services/kong?tail=100

# Stream logs (use WebSocket)
```

**via Dashboard:**
1. Navigate to instance detail page
2. Click "Logs" tab
3. Select service from dropdown
4. Logs stream in real-time

### Get Metrics

**via API:**
```bash
# Latest metrics
curl http://localhost:3001/api/metrics/instances/myproject

# Historical metrics (last 24 hours)
curl "http://localhost:3001/api/metrics/instances/myproject/history?since=2024-01-20T00:00:00Z&limit=1000"

# System-wide metrics
curl http://localhost:3001/api/metrics/system
```

**via Dashboard:**
- Metrics are displayed on the instance detail page
- Charts show trends over time
- Auto-refresh every 15 seconds

## Development

### Backend Development

```bash
cd backend

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run Prisma Studio (database GUI)
npm run prisma:studio
```

### Frontend Development

```bash
cd frontend

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Deployment

### Option 1: Docker Compose (Recommended)

Create `docker-compose.yml` in the dashboard directory:

```yaml
version: '3.8'

services:
  dashboard-backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ../projects:/app/projects
      - ./backend/data:/app/data
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - PROJECTS_PATH=/app/projects
    depends_on:
      - redis

  dashboard-frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - dashboard-backend

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

Start the dashboard:
```bash
docker compose up -d
```

### Option 2: Standalone Deployment

**Backend:**
```bash
cd backend
npm run build
NODE_ENV=production npm start
```

**Frontend:**
```bash
cd frontend
npm run build

# Serve with nginx, or any static file server
npx serve -s dist -l 5173
```

## Features

### Completed ✅

- ✅ Full Node.js backend with TypeScript
- ✅ Docker integration via dockerode
- ✅ Instance lifecycle management (create, start, stop, delete)
- ✅ Health monitoring with real-time updates
- ✅ Resource metrics collection (CPU, memory, disk, network)
- ✅ SQLite database for historical data
- ✅ Redis caching for real-time data
- ✅ Socket.io WebSocket for live updates
- ✅ REST API for all operations
- ✅ Port auto-discovery and allocation
- ✅ Secure key generation (JWT, passwords)
- ✅ Log streaming from containers

### In Progress 🚧

- 🚧 React frontend UI components
- 🚧 Dashboard overview page
- 🚧 Instance detail page
- 🚧 Metrics visualization charts
- 🚧 Log viewer interface
- 🚧 Create instance wizard

### Planned 📋

- 📋 Alert rule configuration UI
- 📋 Notification system (browser, webhook, email)
- 📋 Authentication and user management
- 📋 Multi-host Docker support (remote Docker daemons)
- 📋 Backup and restore functionality
- 📋 Performance optimization
- 📋 Mobile responsive design

## Troubleshooting

### Backend won't start

**Check Docker connectivity:**
```bash
docker ps
```

**Check Redis connectivity:**
```bash
redis-cli ping
```

**Check logs:**
```bash
cd backend
tail -f logs/combined.log
```

### Cannot create instances

**Verify projects path exists:**
```bash
ls -la ../projects
```

**Check Docker socket permissions:**
```bash
ls -l /var/run/docker.sock
# Should be readable by your user
```

**Check port availability:**
```bash
netstat -tuln | grep <port>
```

### WebSocket not connecting

**Verify CORS settings in backend/.env:**
```env
CORS_ORIGIN=http://localhost:5173
```

**Check browser console for errors**

**Ensure Socket.io is running:**
```bash
curl http://localhost:3001/socket.io/
```

## Project Structure Details

### Backend Services

- **DockerManager** - Wraps dockerode, manages container operations
- **InstanceManager** - Creates/deletes instances, manages lifecycle
- **HealthMonitor** - Background service that checks instance health every 10s
- **MetricsCollector** - Background service that collects metrics every 15s
- **RedisCache** - Caching layer for real-time data access

### Frontend (To Be Completed)

- **Dashboard Page** - Grid view of all instances
- **InstanceDetail Page** - Detailed view with tabs (Services, Metrics, Logs, Config)
- **CreateInstance Page** - Wizard for creating new instances
- **Metrics Charts** - Recharts components for visualization
- **Log Viewer** - Real-time log streaming component

## Contributing

The dashboard is part of the Multibase project. Contributions are welcome!

### Adding New Features

1. Backend: Add services in `backend/src/services/`
2. API Routes: Add routes in `backend/src/routes/`
3. Frontend: Add components in `frontend/src/components/`

### Code Style

- TypeScript for all code
- ESLint for linting
- Prettier for formatting

## License

MIT

## Support

For issues or questions:
- Check the logs in `backend/logs/`
- Review the API documentation above
- Check Docker container status: `docker ps -a`

---

**Built with ❤️ for Multibase - Multi-tenant Supabase Management**
