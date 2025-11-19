import { Router, Request, Response } from 'express';
import MetricsCollector from '../services/MetricsCollector';
import { RedisCache } from '../services/RedisCache';
import { logger } from '../utils/logger';

export function createMetricsRoutes(
  metricsCollector: MetricsCollector,
  redisCache: RedisCache
): Router {
  const router = Router();

  /**
   * GET /api/metrics/system
   * Get system-wide metrics
   */
  router.get('/system', async (req: Request, res: Response) => {
    try {
      const { since, limit } = req.query;

      const sinceDate = since ? new Date(since as string) : undefined;
      const limitNum = limit ? parseInt(limit as string, 10) : 100;

      const metrics = await metricsCollector.getSystemMetricsHistory(sinceDate, limitNum);
      // Return the latest metric (last in array) for current system state
      const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : {
        totalCpu: 0,
        totalMemory: 0,
        instanceCount: 0,
        runningCount: 0,
        timestamp: new Date()
      };
      res.json(latestMetric);
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      res.status(500).json({ error: 'Failed to get system metrics' });
    }
  });

  /**
   * GET /api/metrics/instances/:name
   * Get latest metrics for an instance (from Redis cache)
   */
  router.get('/instances/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const metricsMap = await redisCache.getAllMetrics(name);

      const metrics: any = {};
      metricsMap.forEach((value, key) => {
        metrics[key] = value;
      });

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting metrics for instance ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get instance metrics' });
    }
  });

  /**
   * GET /api/metrics/instances/:name/history
   * Get historical metrics for an instance
   */
  router.get('/instances/:name/history', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { service, since, limit } = req.query;

      const sinceDate = since ? new Date(since as string) : undefined;
      const limitNum = limit ? parseInt(limit as string, 10) : 100;

      const metrics = await metricsCollector.getHistoricalMetrics(
        name,
        service as string | undefined,
        sinceDate,
        limitNum
      );

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting historical metrics for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get historical metrics' });
    }
  });

  /**
   * GET /api/metrics/instances/:name/services/:service
   * Get metrics for a specific service
   */
  router.get('/instances/:name/services/:service', async (req: Request, res: Response) => {
    try {
      const { name, service } = req.params;
      const metrics = await redisCache.getMetrics(name, service);

      if (!metrics) {
        return res.status(404).json({ error: 'Metrics not found' });
      }

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting metrics for ${req.params.name}:${req.params.service}:`, error);
      res.status(500).json({ error: 'Failed to get service metrics' });
    }
  });

  return router;
}
