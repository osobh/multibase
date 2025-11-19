import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export function createAlertRoutes(): Router {
  const router = Router();

  /**
   * GET /api/alerts
   * List all alerts with optional filtering
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status, instanceId, rule, limit = '100' } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (instanceId) where.instanceId = instanceId;
      if (rule) where.rule = rule;

      const alerts = await prisma.alert.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        take: parseInt(limit as string, 10),
        include: {
          instance: {
            select: {
              name: true,
              status: true,
            },
          },
        },
      });

      return res.json(alerts);
    } catch (error) {
      logger.error('Error listing alerts:', error);
      return res.status(500).json({ error: 'Failed to list alerts' });
    }
  });

  /**
   * GET /api/alerts/rules
   * List all alert rules
   */
  router.get('/rules', async (req: Request, res: Response) => {
    try {
      const { instanceId, enabled } = req.query;

      const where: any = {};
      if (instanceId) where.instanceId = instanceId;
      if (enabled !== undefined) where.enabled = enabled === 'true';

      const rules = await prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
      });

      return res.json(rules);
    } catch (error) {
      logger.error('Error listing alert rules:', error);
      return res.status(500).json({ error: 'Failed to list alert rules' });
    }
  });

  /**
   * POST /api/alerts/rules
   * Create a new alert rule
   */
  router.post('/rules', async (req: Request, res: Response) => {
    try {
      const {
        instanceId,
        name,
        rule,
        condition,
        threshold,
        duration,
        enabled = true,
        notificationChannels,
        webhookUrl,
      } = req.body;

      // Validate required fields
      if (!instanceId || !name || !rule || !condition) {
        return res.status(400).json({
          error: 'Missing required fields: instanceId, name, rule, condition',
        });
      }

      // Verify instance exists
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      const alert = await prisma.alert.create({
        data: {
          instanceId,
          name,
          rule,
          condition: JSON.stringify(condition),
          threshold,
          duration,
          enabled,
          status: 'active',
          notificationChannels: notificationChannels
            ? JSON.stringify(notificationChannels)
            : null,
          webhookUrl,
        },
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
      });

      logger.info(`Alert rule created: ${name} for instance ${instance.name}`);
      return res.status(201).json(alert);
    } catch (error: any) {
      logger.error('Error creating alert rule:', error);
      return res.status(500).json({ error: error.message || 'Failed to create alert rule' });
    }
  });

  /**
   * PUT /api/alerts/rules/:id
   * Update an alert rule
   */
  router.put('/rules/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        rule,
        condition,
        threshold,
        duration,
        enabled,
        notificationChannels,
        webhookUrl,
      } = req.body;

      const alertId = parseInt(id, 10);
      if (isNaN(alertId)) {
        return res.status(400).json({ error: 'Invalid alert ID' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (rule !== undefined) updateData.rule = rule;
      if (condition !== undefined) updateData.condition = JSON.stringify(condition);
      if (threshold !== undefined) updateData.threshold = threshold;
      if (duration !== undefined) updateData.duration = duration;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (notificationChannels !== undefined) {
        updateData.notificationChannels = JSON.stringify(notificationChannels);
      }
      if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;

      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: updateData,
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
      });

      logger.info(`Alert rule updated: ID ${id}`);
      return res.json(alert);
    } catch (error: any) {
      logger.error(`Error updating alert rule ${req.params.id}:`, error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Alert rule not found' });
      }
      return res.status(500).json({ error: error.message || 'Failed to update alert rule' });
    }
  });

  /**
   * DELETE /api/alerts/rules/:id
   * Delete an alert rule
   */
  router.delete('/rules/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const alertId = parseInt(id, 10);

      if (isNaN(alertId)) {
        return res.status(400).json({ error: 'Invalid alert ID' });
      }

      await prisma.alert.delete({
        where: { id: alertId },
      });

      logger.info(`Alert rule deleted: ID ${id}`);
      return res.json({ message: `Alert rule ${id} deleted successfully` });
    } catch (error: any) {
      logger.error(`Error deleting alert rule ${req.params.id}:`, error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Alert rule not found' });
      }
      return res.status(500).json({ error: error.message || 'Failed to delete alert rule' });
    }
  });

  /**
   * POST /api/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  router.post('/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const alertId = parseInt(id, 10);

      if (isNaN(alertId)) {
        return res.status(400).json({ error: 'Invalid alert ID' });
      }

      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
        },
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
      });

      logger.info(`Alert acknowledged: ID ${id}`);
      return res.json(alert);
    } catch (error: any) {
      logger.error(`Error acknowledging alert ${req.params.id}:`, error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Alert not found' });
      }
      return res.status(500).json({ error: error.message || 'Failed to acknowledge alert' });
    }
  });

  /**
   * POST /api/alerts/:id/resolve
   * Resolve an alert
   */
  router.post('/:id/resolve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const alertId = parseInt(id, 10);

      if (isNaN(alertId)) {
        return res.status(400).json({ error: 'Invalid alert ID' });
      }

      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
        },
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
      });

      logger.info(`Alert resolved: ID ${id}`);
      return res.json(alert);
    } catch (error: any) {
      logger.error(`Error resolving alert ${req.params.id}:`, error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Alert not found' });
      }
      return res.status(500).json({ error: error.message || 'Failed to resolve alert' });
    }
  });

  /**
   * GET /api/alerts/stats
   * Get alert statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.query;

      const where: any = {};
      if (instanceId) where.instanceId = instanceId;

      const [total, active, acknowledged, resolved] = await Promise.all([
        prisma.alert.count({ where }),
        prisma.alert.count({ where: { ...where, status: 'active' } }),
        prisma.alert.count({ where: { ...where, status: 'acknowledged' } }),
        prisma.alert.count({ where: { ...where, status: 'resolved' } }),
      ]);

      return res.json({
        total,
        active,
        acknowledged,
        resolved,
      });
    } catch (error) {
      logger.error('Error getting alert stats:', error);
      return res.status(500).json({ error: 'Failed to get alert statistics' });
    }
  });

  return router;
}
