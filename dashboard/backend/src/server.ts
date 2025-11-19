import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Services
import DockerManager from './services/DockerManager';
import InstanceManager from './services/InstanceManager';
import HealthMonitor from './services/HealthMonitor';
import MetricsCollector from './services/MetricsCollector';
import { RedisCache } from './services/RedisCache';

// Routes
import { createInstanceRoutes } from './routes/instances';
import { createMetricsRoutes } from './routes/metrics';
import { createHealthRoutes } from './routes/health';
import { createLogsRoutes } from './routes/logs';
import { createAlertRoutes } from './routes/alerts';

// Utils
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
// Parse CORS origins - supports comma-separated list for multiple origins
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];
const PROJECTS_PATH = process.env.PROJECTS_PATH || path.join(__dirname, '../../projects');
const DOCKER_SOCKET_PATH = process.env.DOCKER_SOCKET_PATH;
const METRICS_INTERVAL = parseInt(process.env.METRICS_INTERVAL || '15000', 10);
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000', 10);

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  // Trust proxy headers when behind nginx reverse proxy
  // Allows Socket.io to detect real client IP and protocol from X-Forwarded-* headers
  path: '/socket.io/'
});

// Middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Initialize services
const prisma = new PrismaClient();
const dockerManager = new DockerManager(DOCKER_SOCKET_PATH);
const redisCache = new RedisCache();
const instanceManager = new InstanceManager(PROJECTS_PATH, dockerManager);
const healthMonitor = new HealthMonitor(
  dockerManager,
  instanceManager,
  redisCache,
  HEALTH_CHECK_INTERVAL
);
const metricsCollector = new MetricsCollector(
  dockerManager,
  instanceManager,
  redisCache,
  prisma,
  METRICS_INTERVAL
);

// API Routes
app.use('/api/instances', createInstanceRoutes(instanceManager, dockerManager));
app.use('/api/metrics', createMetricsRoutes(metricsCollector, redisCache));
app.use('/api/health', createHealthRoutes(healthMonitor));
app.use('/api/logs', createLogsRoutes(dockerManager));
app.use('/api/alerts', createAlertRoutes());

// Health check endpoint for the dashboard itself
app.get('/api/ping', async (req, res) => {
  try {
    const dockerOk = await dockerManager.ping();
    const redisOk = await redisCache.ping();

    res.json({
      status: 'ok',
      services: {
        docker: dockerOk,
        redis: redisOk
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Multibase Dashboard API',
    version: '1.0.0',
    status: 'running'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Socket error handling
  socket.on('error', (error) => {
    logger.error(`Socket error for client ${socket.id}:`, error);
  });

  // NOTE: Removed slow listInstances() call from connection handler
  // The frontend already fetches instances via GET /api/instances
  // Socket.io is only used for real-time updates (health changes, metrics)
  // Calling listInstances() here was causing 54-second delay and connection timeouts

  // Subscribe to log streaming
  socket.on('logs:subscribe', async (data: { instanceName: string; serviceName: string }) => {
    try {
      const { instanceName, serviceName } = data;
      logger.info(`Client ${socket.id} subscribed to logs: ${instanceName}:${serviceName}`);

      const containers = await dockerManager.listProjectContainers(instanceName);
      const container = containers.find(c => {
        const containerName = c.Names[0].replace('/', '');
        return containerName.includes(serviceName);
      });

      if (container) {
        dockerManager.streamContainerLogs(container.Id, (chunk) => {
          socket.emit('logs:data', {
            instanceName,
            serviceName,
            data: chunk
          });
        });
      }
    } catch (error) {
      logger.error('Error subscribing to logs:', error);
      socket.emit('logs:error', { error: 'Failed to subscribe to logs' });
    }
  });

  // Unsubscribe from logs
  socket.on('logs:unsubscribe', () => {
    logger.info(`Client ${socket.id} unsubscribed from logs`);
    // Cleanup would go here
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Event handlers for real-time updates

// Health status changes
healthMonitor.on('health:changed', (event) => {
  logger.info('Health changed event:', event);
  io.emit('health:update', event);
});

// Alert triggers
healthMonitor.on('alert:triggered', (event) => {
  logger.warn('Alert triggered:', event);
  io.emit('alert:triggered', event);
});

// Metrics collected
metricsCollector.on('metrics:collected', (metrics) => {
  io.emit('metrics:update', metrics);
});

// Start background services
async function startServices() {
  try {
    logger.info('Starting background services...');

    // Check Docker connectivity
    const dockerOk = await dockerManager.ping();
    if (!dockerOk) {
      logger.error('Docker is not accessible. Please check Docker daemon.');
      process.exit(1);
    }

    // Check Redis connectivity
    const redisOk = await redisCache.ping();
    if (!redisOk) {
      logger.warn('Redis is not accessible. Caching will be disabled.');
    }

    // Start health monitoring
    healthMonitor.start();

    // Start metrics collection
    metricsCollector.start();

    logger.info('Background services started successfully');
  } catch (error) {
    logger.error('Error starting services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');

  healthMonitor.stop();
  metricsCollector.stop();

  await redisCache.close();
  await prisma.$disconnect();

  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Error handlers
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown();
});

// Start server
async function start() {
  try {
    await startServices();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Multibase Dashboard API running on port ${PORT}`);
      logger.info(`📊 WebSocket server ready`);
      logger.info(`🔗 CORS enabled for: ${CORS_ORIGIN}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
