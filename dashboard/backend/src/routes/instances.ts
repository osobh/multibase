import { Router, Request, Response } from 'express';
import { CreateInstanceRequest } from '../types';
import InstanceManager from '../services/InstanceManager';
import DockerManager from '../services/DockerManager';
import { logger } from '../utils/logger';

export function createInstanceRoutes(
  instanceManager: InstanceManager,
  dockerManager: DockerManager
): Router {
  const router = Router();

  /**
   * GET /api/instances
   * List all instances
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const instances = await instanceManager.listInstances();
      res.json(instances);
    } catch (error) {
      logger.error('Error listing instances:', error);
      res.status(500).json({ error: 'Failed to list instances' });
    }
  });

  /**
   * GET /api/instances/:name
   * Get specific instance details
   */
  router.get('/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const instance = await instanceManager.getInstance(name);

      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      res.json(instance);
    } catch (error) {
      logger.error(`Error getting instance ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get instance' });
    }
  });

  /**
   * POST /api/instances
   * Create a new instance
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const createRequest: CreateInstanceRequest = req.body;

      // Validate required fields
      if (!createRequest.name) {
        return res.status(400).json({ error: 'Instance name is required' });
      }

      if (!createRequest.deploymentType) {
        return res.status(400).json({ error: 'Deployment type is required' });
      }

      const instance = await instanceManager.createInstance(createRequest);
      res.status(201).json(instance);
    } catch (error: any) {
      logger.error('Error creating instance:', error);
      res.status(500).json({ error: error.message || 'Failed to create instance' });
    }
  });

  /**
   * DELETE /api/instances/:name
   * Delete an instance
   */
  router.delete('/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { removeVolumes } = req.query;

      await instanceManager.deleteInstance(name, removeVolumes === 'true');
      res.json({ message: `Instance ${name} deleted successfully` });
    } catch (error: any) {
      logger.error(`Error deleting instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to delete instance' });
    }
  });

  /**
   * POST /api/instances/:name/start
   * Start an instance
   */
  router.post('/:name/start', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      await instanceManager.startInstance(name);
      res.json({ message: `Instance ${name} started successfully` });
    } catch (error: any) {
      logger.error(`Error starting instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to start instance' });
    }
  });

  /**
   * POST /api/instances/:name/stop
   * Stop an instance
   */
  router.post('/:name/stop', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { keepVolumes } = req.query;

      await instanceManager.stopInstance(name, keepVolumes !== 'false');
      res.json({ message: `Instance ${name} stopped successfully` });
    } catch (error: any) {
      logger.error(`Error stopping instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to stop instance' });
    }
  });

  /**
   * POST /api/instances/:name/restart
   * Restart an instance
   */
  router.post('/:name/restart', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      await instanceManager.restartInstance(name);
      res.json({ message: `Instance ${name} restarted successfully` });
    } catch (error: any) {
      logger.error(`Error restarting instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to restart instance' });
    }
  });

  /**
   * POST /api/instances/:name/services/:service/restart
   * Restart a specific service
   */
  router.post('/:name/services/:service/restart', async (req: Request, res: Response) => {
    try {
      const { name, service } = req.params;
      await dockerManager.restartService(name, service);
      res.json({ message: `Service ${service} in ${name} restarted successfully` });
    } catch (error: any) {
      logger.error(`Error restarting service ${req.params.service} in ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to restart service' });
    }
  });

  /**
   * PUT /api/instances/:name/credentials
   * Update instance credentials
   */
  router.put('/:name/credentials', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { regenerateKeys } = req.body;

      const credentials = await instanceManager.updateCredentials(name, regenerateKeys);
      res.json(credentials);
    } catch (error: any) {
      logger.error(`Error updating credentials for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to update credentials' });
    }
  });

  /**
   * GET /api/instances/:name/services
   * Get services status for an instance
   */
  router.get('/:name/services', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const services = await dockerManager.getServiceStatus(name);
      res.json(services);
    } catch (error) {
      logger.error(`Error getting services for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  });

  return router;
}
