import { Router, Request, Response } from 'express';
import DockerManager from '../services/DockerManager';
import { logger } from '../utils/logger';

export function createLogsRoutes(dockerManager: DockerManager): Router {
  const router = Router();

  /**
   * GET /api/logs/instances/:name/services/:service
   * Get logs for a specific service
   */
  router.get('/instances/:name/services/:service', async (req: Request, res: Response) => {
    try {
      const { name, service } = req.params;
      const { tail, since } = req.query;

      const containers = await dockerManager.listProjectContainers(name);
      const container = containers.find(c => {
        const containerName = c.Names[0].replace('/', '');
        return containerName.includes(service);
      });

      if (!container) {
        return res.status(404).json({ error: `Service ${service} not found` });
      }

      const logs = await dockerManager.getContainerLogs(container.Id, {
        tail: tail ? parseInt(tail as string, 10) : 100,
        since: since ? parseInt(since as string, 10) : undefined,
        timestamps: true
      });

      res.json(logs);
    } catch (error) {
      logger.error(`Error getting logs for ${req.params.name}:${req.params.service}:`, error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  /**
   * GET /api/logs/instances/:name
   * Get logs for all services in an instance
   */
  router.get('/instances/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { tail } = req.query;

      const containers = await dockerManager.listProjectContainers(name);
      const allLogsLines: string[] = [];

      for (const container of containers) {
        const containerName = container.Names[0].replace('/', '');
        const logs = await dockerManager.getContainerLogs(container.Id, {
          tail: tail ? parseInt(tail as string, 10) : 50,
          timestamps: true
        });

        // Add container label to each log line
        const lines = logs.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          allLogsLines.push(`[${containerName}] ${line}`);
        });
      }

      res.json(allLogsLines.join('\n'));
    } catch (error) {
      logger.error(`Error getting logs for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  return router;
}
