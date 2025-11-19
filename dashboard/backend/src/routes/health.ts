import { Router, Request, Response } from 'express';
import HealthMonitor from '../services/HealthMonitor';
import { logger } from '../utils/logger';

export function createHealthRoutes(healthMonitor: HealthMonitor): Router {
  const router = Router();

  /**
   * GET /api/health/instances/:name
   * Get health status for an instance
   */
  router.get('/instances/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const health = await healthMonitor.getCachedHealth(name);

      if (!health) {
        // If not cached, fetch fresh
        const freshHealth = await healthMonitor.refreshInstanceHealth(name);
        return res.json(freshHealth);
      }

      res.json(health);
    } catch (error) {
      logger.error(`Error getting health for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get health status' });
    }
  });

  /**
   * POST /api/health/instances/:name/refresh
   * Force refresh health status for an instance
   */
  router.post('/instances/:name/refresh', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const health = await healthMonitor.refreshInstanceHealth(name);
      res.json(health);
    } catch (error) {
      logger.error(`Error refreshing health for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to refresh health status' });
    }
  });

  return router;
}
