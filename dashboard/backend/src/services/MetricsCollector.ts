import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { SystemMetrics } from '../types';
import DockerManager from './DockerManager';
import InstanceManager from './InstanceManager';
import { RedisCache } from './RedisCache';
import { logger } from '../utils/logger';

export class MetricsCollector extends EventEmitter {
  private dockerManager: DockerManager;
  private instanceManager: InstanceManager;
  private redisCache: RedisCache;
  private prisma: PrismaClient;
  private interval: NodeJS.Timeout | null = null;
  private collectionInterval: number;
  private isRunning: boolean = false;

  constructor(
    dockerManager: DockerManager,
    instanceManager: InstanceManager,
    redisCache: RedisCache,
    prisma: PrismaClient,
    collectionInterval: number = 15000
  ) {
    super();
    this.dockerManager = dockerManager;
    this.instanceManager = instanceManager;
    this.redisCache = redisCache;
    this.prisma = prisma;
    this.collectionInterval = collectionInterval;
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Metrics collector is already running');
      return;
    }

    logger.info(`Starting metrics collector (interval: ${this.collectionInterval}ms)`);
    this.isRunning = true;

    // Immediate collection
    this.collectAllMetrics();

    // Schedule periodic collection
    this.interval = setInterval(() => {
      this.collectAllMetrics();
    }, this.collectionInterval);
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping metrics collector');

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
  }

  /**
   * Collect metrics for all instances
   */
  private async collectAllMetrics(): Promise<void> {
    try {
      const instances = await this.instanceManager.listInstances();

      let totalCpu = 0;
      let totalMemory = 0;
      let totalDisk = 0;
      let runningCount = 0;

      for (const instance of instances) {
        const instanceMetrics = await this.collectInstanceMetrics(instance.name);

        if (instanceMetrics) {
          totalCpu += instanceMetrics.cpu;
          totalMemory += instanceMetrics.memory;
          totalDisk += instanceMetrics.disk;

          if (instance.status === 'running' || instance.status === 'healthy') {
            runningCount++;
          }
        }
      }

      // Store system-wide metrics
      const systemMetrics: SystemMetrics = {
        totalCpu,
        totalMemory,
        totalDisk,
        instanceCount: instances.length,
        runningCount,
        timestamp: new Date()
      };

      await this.storeSystemMetrics(systemMetrics);

      // Emit metrics update event
      this.emit('metrics:collected', systemMetrics);
    } catch (error) {
      logger.error('Error collecting all metrics:', error);
    }
  }

  /**
   * Collect metrics for a specific instance
   */
  async collectInstanceMetrics(instanceName: string): Promise<{ cpu: number; memory: number; disk: number } | null> {
    try {
      const containers = await this.dockerManager.listProjectContainers(instanceName);

      let instanceCpu = 0;
      let instanceMemory = 0;
      let instanceDisk = 0;

      for (const container of containers) {
        const metrics = await this.dockerManager.getContainerStats(container.Id);

        if (metrics) {
          instanceCpu += metrics.cpu;
          instanceMemory += metrics.memory;
          instanceDisk += metrics.diskRead + metrics.diskWrite;

          // Extract service name
          const containerName = container.Names[0].replace('/', '');
          const serviceName = this.extractServiceName(containerName, instanceName);

          // Cache in Redis for real-time access
          await this.redisCache.setMetrics(instanceName, serviceName, metrics);

          // Store in database for historical analysis
          await this.storeMetrics(instanceName, serviceName, metrics);
        }
      }

      return {
        cpu: instanceCpu,
        memory: instanceMemory,
        disk: instanceDisk
      };
    } catch (error) {
      logger.error(`Error collecting metrics for ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(instanceName: string, serviceName: string, metrics: any): Promise<void> {
    try {
      await this.prisma.metric.create({
        data: {
          instanceId: instanceName,
          service: serviceName,
          cpu: metrics.cpu,
          memory: metrics.memory,
          networkRx: metrics.networkRx,
          networkTx: metrics.networkTx,
          diskRead: metrics.diskRead,
          diskWrite: metrics.diskWrite,
          timestamp: metrics.timestamp
        }
      });
    } catch (error) {
      // If instance doesn't exist in DB, create it
      if ((error as any).code === 'P2003') {
        try {
          await this.prisma.instance.create({
            data: {
              id: instanceName,
              name: instanceName,
              basePort: 0, // Will be updated later
              status: 'running'
            }
          });

          // Retry storing metrics
          await this.storeMetrics(instanceName, serviceName, metrics);
        } catch (createError) {
          logger.error(`Error creating instance ${instanceName} in database:`, createError);
        }
      } else {
        logger.error(`Error storing metrics for ${instanceName}:${serviceName}:`, error);
      }
    }
  }

  /**
   * Store system-wide metrics
   */
  private async storeSystemMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await this.prisma.systemMetric.create({
        data: {
          totalCpu: metrics.totalCpu,
          totalMemory: metrics.totalMemory,
          totalDisk: metrics.totalDisk,
          instanceCount: metrics.instanceCount,
          runningCount: metrics.runningCount,
          timestamp: metrics.timestamp
        }
      });
    } catch (error) {
      logger.error('Error storing system metrics:', error);
    }
  }

  /**
   * Get historical metrics for an instance
   */
  async getHistoricalMetrics(
    instanceName: string,
    serviceName?: string,
    since?: Date,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const where: any = {
        instanceId: instanceName
      };

      if (serviceName) {
        where.service = serviceName;
      }

      if (since) {
        where.timestamp = {
          gte: since
        };
      }

      const metrics = await this.prisma.metric.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });

      return metrics.reverse(); // Return in chronological order
    } catch (error) {
      logger.error(`Error getting historical metrics for ${instanceName}:`, error);
      return [];
    }
  }

  /**
   * Get system metrics history
   */
  async getSystemMetricsHistory(since?: Date, limit: number = 100): Promise<SystemMetrics[]> {
    try {
      const where: any = {};

      if (since) {
        where.timestamp = {
          gte: since
        };
      }

      const metrics = await this.prisma.systemMetric.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });

      return metrics.reverse() as SystemMetrics[];
    } catch (error) {
      logger.error('Error getting system metrics history:', error);
      return [];
    }
  }

  /**
   * Clean up old metrics (older than specified days)
   */
  async cleanupOldMetrics(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.metric.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`Cleaned up ${result.count} old metric records`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old metrics:', error);
      return 0;
    }
  }

  /**
   * Extract service name from container name
   */
  private extractServiceName(containerName: string, projectName: string): string {
    if (containerName.includes('realtime-dev.')) {
      return 'realtime';
    }

    const parts = containerName.split('-');
    const projectIndex = parts.indexOf(projectName);

    if (projectIndex !== -1 && projectIndex < parts.length - 1) {
      return parts.slice(projectIndex + 1).join('-');
    }

    return containerName;
  }
}

export default MetricsCollector;
