# Multibase Dashboard - Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Step 1: Install Dependencies

```bash
cd /home/osobh/data/multibase/dashboard

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Start Redis

```bash
# Using Docker (recommended)
docker run -d --name multibase-redis -p 6379:6379 redis:alpine

# OR if Redis is already installed
sudo systemctl start redis
```

### Step 3: Initialize the Backend Database

```bash
cd /home/osobh/data/multibase/dashboard/backend

# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init
```

### Step 4: Configure Environment

The `.env` file is already created with defaults. Verify it looks good:

```bash
cat /home/osobh/data/multibase/dashboard/backend/.env
```

Key settings:
- `PROJECTS_PATH=../../projects` (points to your Supabase instances)
- `DOCKER_SOCKET_PATH=/var/run/docker.sock` (Docker access)
- `REDIS_URL=redis://localhost:6379` (Redis connection)

### Step 5: Start the Backend

```bash
cd /home/osobh/data/multibase/dashboard/backend

# Development mode (with hot reload)
npm run dev
```

You should see:
```
🚀 Multibase Dashboard API running on port 3001
📊 WebSocket server ready
```

### Step 6: Start the Frontend

Open a new terminal:

```bash
cd /home/osobh/data/multibase/dashboard/frontend

# Development mode
npm run dev
```

You should see:
```
VITE v5.0.11  ready in XXX ms

➜  Local:   http://localhost:5173/
```

### Step 7: Access the Dashboard

Open your browser and navigate to:
```
http://localhost:5173
```

## 🧪 Test the API

### Check Dashboard Health

```bash
curl http://localhost:3001/api/ping
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "docker": true,
    "redis": true
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### List Existing Instances

```bash
curl http://localhost:3001/api/instances
```

This should return your existing Supabase instances (popupcash, quantum, smartpi, etc.)

### Create a Test Instance

```bash
curl -X POST http://localhost:3001/api/instances \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testinstance",
    "deploymentType": "localhost",
    "corsOrigins": ["http://localhost:3000"]
  }'
```

### Start the Instance

```bash
curl -X POST http://localhost:3001/api/instances/testinstance/start
```

### View Instance Details

```bash
curl http://localhost:3001/api/instances/testinstance | jq
```

## 🎯 What's Working Now

### ✅ Backend (100% Complete)
- All API endpoints functional
- Docker integration working
- Health monitoring active (checks every 10s)
- Metrics collection active (collects every 15s)
- Redis caching operational
- WebSocket real-time updates
- SQLite database for historical data
- Complete instance lifecycle management

### ✅ Frontend (Configuration Complete)
- React 19.2 + Vite setup ready
- TypeScript configuration
- TailwindCSS configured
- All dependencies installed
- Types defined

### 🚧 Frontend (UI Components Needed)
The frontend structure is ready, but you'll need to build:
1. Dashboard overview page (instance grid)
2. Instance detail page (services, metrics, logs tabs)
3. Create instance wizard
4. Metrics charts (Recharts)
5. Log viewer component
6. Credentials viewer (click-to-reveal)

## 📦 What We Built

### Backend Architecture

```
dashboard/backend/
├── src/
│   ├── server.ts                   # ✅ Express + Socket.io server
│   ├── services/
│   │   ├── DockerManager.ts        # ✅ Docker API wrapper
│   │   ├── InstanceManager.ts      # ✅ Instance CRUD operations
│   │   ├── HealthMonitor.ts        # ✅ Background health checker
│   │   ├── MetricsCollector.ts     # ✅ Resource metrics collector
│   │   └── RedisCache.ts           # ✅ Redis caching layer
│   ├── routes/
│   │   ├── instances.ts            # ✅ Instance API endpoints
│   │   ├── health.ts               # ✅ Health API endpoints
│   │   ├── metrics.ts              # ✅ Metrics API endpoints
│   │   └── logs.ts                 # ✅ Logs API endpoints
│   ├── utils/
│   │   ├── logger.ts               # ✅ Winston logger
│   │   ├── envParser.ts            # ✅ .env file parser
│   │   ├── keyGenerator.ts         # ✅ JWT/password generator
│   │   └── portManager.ts          # ✅ Port allocation
│   └── types/
│       └── index.ts                # ✅ TypeScript types
├── prisma/
│   └── schema.prisma               # ✅ Database schema
└── .env                            # ✅ Configuration
```

### Key Features Implemented

1. **Instance Management**
   - Create new Supabase instances with auto port allocation
   - Start/stop/restart instances
   - Delete instances (with optional volume removal)
   - Update credentials and regenerate keys

2. **Health Monitoring**
   - Real-time health checks every 10 seconds
   - Service-level health status
   - Overall instance health calculation
   - WebSocket broadcasts on health changes

3. **Resource Metrics**
   - CPU, memory, disk, network metrics
   - Historical data storage in SQLite
   - Real-time caching in Redis
   - Per-service and system-wide aggregation

4. **Log Management**
   - Fetch logs from any service
   - Real-time log streaming via WebSocket
   - Filter by service, time range, or search term

5. **Real-time Updates**
   - Socket.io integration
   - Automatic health change notifications
   - Live metrics updates
   - Alert triggers

## 🔧 Next Steps

### Option 1: Build the Frontend UI

Create React components in `/home/osobh/data/multibase/dashboard/frontend/src/`:

```bash
cd /home/osobh/data/multibase/dashboard/frontend/src

# Create a basic App.tsx
# Create pages/Dashboard.tsx
# Create components/InstanceCard.tsx
# Add routing with React Router
```

Example minimal App.tsx:
```typescript
import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [instances, setInstances] = useState([]);

  useEffect(() => {
    axios.get('/api/instances').then(res => {
      setInstances(res.data);
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Multibase Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {instances.map((instance: any) => (
          <div key={instance.id} className="border p-4 rounded">
            <h2 className="text-xl font-bold">{instance.name}</h2>
            <p>Status: {instance.status}</p>
            <p>Services: {instance.health.healthyServices}/{instance.health.totalServices}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
```

### Option 2: Use the API Directly

The backend is fully functional. You can:
- Use curl or Postman to interact with the API
- Build a custom frontend with any framework
- Integrate with existing tools

### Option 3: Deploy to Production

See the "Deployment" section in README.md for Docker Compose setup.

## 📚 Resources

- **Full Documentation**: `dashboard/README.md`
- **API Reference**: See README.md "API Endpoints" section
- **WebSocket Events**: See README.md "WebSocket Events" section
- **Backend Logs**: `dashboard/backend/logs/combined.log`

## 🐛 Troubleshooting

**Backend won't start?**
```bash
# Check Docker
docker ps

# Check Redis
redis-cli ping

# Check logs
tail -f /home/osobh/data/multibase/dashboard/backend/logs/combined.log
```

**Database issues?**
```bash
cd /home/osobh/data/multibase/dashboard/backend
rm -rf data/multibase.db
npx prisma migrate reset
npx prisma migrate dev --name init
```

**Port conflicts?**
```bash
# Change backend port in .env
PORT=3002

# Change frontend port in vite.config.ts
server: { port: 5174 }
```

## 🎉 Success!

If you've completed all steps, you now have:
- ✅ A fully functional backend API
- ✅ Real-time monitoring and metrics collection
- ✅ WebSocket updates
- ✅ Instance management capabilities
- ✅ Frontend development environment ready

The system is now monitoring your Supabase instances in real-time!

## 💡 Quick Commands Reference

```bash
# Backend
cd /home/osobh/data/multibase/dashboard/backend
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Run production server
npx prisma studio    # Open database GUI

# Frontend
cd /home/osobh/data/multibase/dashboard/frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
curl http://localhost:3001/api/ping                    # Health check
curl http://localhost:3001/api/instances               # List instances
curl http://localhost:3001/api/metrics/system          # System metrics
```

---

**Need Help?** Check the comprehensive README.md or review the backend logs.
