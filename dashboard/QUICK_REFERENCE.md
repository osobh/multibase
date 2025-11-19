# Multibase Dashboard - Quick Reference

## 🚀 Quick Start

```bash
# Start all services
./launch.sh

# Stop all services
./stop.sh

# Check status
./status.sh
```

## 📍 Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3005 (or check `./status.sh` for current port)
- **API Docs**: http://localhost:3005/api

## ✨ Features Implemented

### 1. Create Instance
- Click "Create Instance" button in dashboard header
- Fill out form (name, deployment type, ports, etc.)
- Credentials auto-generated securely
- Automatically navigates to new instance

### 2. Dashboard
- **System Overview**: Total CPU/Memory gauges, instance counts
- **Stats Cards**: Total instances, healthy instances, total services
- **Instance Grid**: Cards for each instance with quick actions
- **Alert Badge**: Shows active alerts count

### 3. Instance Detail (`/instances/:name`)
Four tabs with comprehensive monitoring:

**Services Tab**
- Service status and health
- Restart individual services

**Metrics Tab**
- **Current Snapshot**: Large CPU & Memory gauges
- **Network & Disk I/O**: Current rates
- **Time Series Trends**: Line charts with 1h/6h/24h/7d selector
  - CPU & Memory over time
  - Network traffic
  - Disk I/O
- **Service Comparison**: Bar charts comparing CPU/Memory across services
- **Service Table**: Detailed metrics per service

**Logs Tab**
- Real-time log streaming
- Service selector
- Auto-scroll
- Download logs

**Credentials Tab**
- Click-to-reveal credentials
- Copy to clipboard
- Regenerate keys

### 4. Alerts (`/alerts`)
- **Stats Overview**: Total, Active, Acknowledged, Resolved
- **Status Filtering**: View by status
- **Alert History**: Table with all alerts
- **Actions**: Acknowledge, Resolve alerts
- **Instance Links**: Click to jump to instance

### 5. Alert Rules (`/alert-rules`)
- **Create Rules**: Form to configure alert rules
- **Rule Types**: High CPU, High Memory, High Disk, Service Down, Slow Response
- **Threshold Configuration**: Set % thresholds
- **Duration**: How long before triggering
- **Enable/Disable**: Toggle rules on/off
- **Delete Rules**: Remove unwanted rules

## 🔧 Common Tasks

### Create an Instance
1. Dashboard → "Create Instance" button
2. Enter name (e.g., `my-project`)
3. Select deployment type (localhost/cloud)
4. Optionally set base port
5. Click "Create Instance"
6. View credentials on instance detail page

### Monitor an Instance
1. Dashboard → Click instance card "View Details"
2. Navigate between tabs:
   - Services: Check service health
   - Metrics: View CPU/Memory/Network trends
   - Logs: Stream real-time logs
   - Credentials: Access keys and passwords

### Set Up Alerts
1. Navigate to `/alert-rules`
2. Click "Create Rule"
3. Select instance
4. Choose rule type (e.g., "High CPU Usage")
5. Set threshold (e.g., 80%)
6. Set duration (e.g., 300 seconds)
7. Click "Create Rule"

### Check Alerts
1. Dashboard → Click "Alerts" badge (shows active count)
2. Filter by status (All/Active/Acknowledged/Resolved)
3. Click "Acknowledge" or "Resolve" for each alert

## 📝 Logs

```bash
# Backend logs
tail -f backend/logs/backend.log

# Frontend logs
tail -f frontend/logs/frontend.log

# Instance-specific logs
# Use the Logs tab in instance detail page
```

## 🔍 Troubleshooting

### Services won't start
```bash
# Check what's using the ports
./status.sh

# Kill any orphaned processes
pkill -f "tsx"
pkill -f "vite"

# Restart fresh
./stop.sh
./launch.sh
```

### Frontend not accessible
- Frontend runs on port 5173 (Vite default)
- Backend auto-selects available ports
- Check `./status.sh` for current URLs

### Can't connect to instance
- Ensure Docker containers are running: `docker ps`
- Check instance status in dashboard
- Try restarting instance from instance detail page

### Database issues
```bash
# Reinitialize database
cd backend
npx prisma db push
npx prisma generate
```

### Redis not running
```bash
# Start Redis container
docker run -d --name multibase-redis -p 6379:6379 redis:alpine

# Or use launch script
./launch.sh  # Auto-starts Redis
```

## 📊 Features Summary

| Feature | Status | Location |
|---------|--------|----------|
| Create Instance Modal | ✅ Complete | Dashboard header |
| Gauge Charts | ✅ Complete | Instance Metrics tab |
| Time Series Charts | ✅ Complete | Instance Metrics tab |
| Service Comparison | ✅ Complete | Instance Metrics tab |
| System Overview | ✅ Complete | Dashboard |
| Alert Center | ✅ Complete | `/alerts` |
| Alert Rules | ✅ Complete | `/alert-rules` |
| Real-time Updates | ✅ Complete | WebSocket |

## 🎯 Keyboard Shortcuts

_Coming soon in next update_

## 📦 Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript + Socket.io
- **Database**: SQLite + Prisma ORM
- **Cache**: Redis
- **Charts**: Recharts
- **Infrastructure**: Docker + dockerode

## 🔗 Useful Commands

```bash
# Full rebuild
cd frontend && npm run build
cd backend && npm run build

# Clear all data (careful!)
rm backend/data/multibase.db
cd backend && npx prisma db push

# View all running containers
docker ps

# Check Redis
docker exec -it multibase-redis redis-cli ping
```

## 💡 Tips

1. **Auto-refresh**: Charts and stats auto-refresh (10-30s intervals)
2. **Real-time logs**: Use Logs tab for live streaming
3. **Port conflicts**: Launch script auto-finds available ports
4. **Single user**: No authentication needed for localhost
5. **Backups**: SQLite DB is in `backend/data/multibase.db`

---

**Need help?** Check the full README.md or SCRIPTS.md for detailed documentation.
