import { EventEmitter } from 'events';
import { HealthStatus } from '../types';
import DockerManager from './DockerManager';
import InstanceManager from './InstanceManager';
import { RedisCache } from './RedisCache';
import { logger } from '../utils/logger';

export class HealthMonitor extends EventEmitter {
  private dockerManager: DockerManager;
  private instanceManager: InstanceManager;
  private redisCache: RedisCache;
  private interval: NodeJS.Timeout | null = null;
  private checkInterval: number;
  private isRunning: boolean = false;

  constructor(
    dockerManager: DockerManager,
    instanceManager: InstanceManager,
    redisCache: RedisCache,
    checkInterval: number = 10000
  ) {
    super();
    this.dockerManager = dockerManager;
    this.instanceManager = instanceManager;
    this.redisCache = redisCache;
    this.checkInterval = checkInterval;
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }

    logger.info(`Starting health monitor (interval: ${this.checkInterval}ms)`);
    this.isRunning = true;

    // Immediate check
    this.checkAllInstances();

    // Schedule periodic checks
    this.interval = setInterval(() => {
      this.checkAllInstances();
    }, this.checkInterval);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping health monitor');

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
  }

  /**
   * Check health of all instances
   */
  private async checkAllInstances(): Promise<void> {
    try {
      const instances = await this.instanceManager.listInstances();

      for (const instance of instances) {
        await this.checkInstanceHealth(instance.name);
      }
    } catch (error) {
      logger.error('Error checking all instances:', error);
    }
  }

  /**
   * Check health of a specific instance
   */
  async checkInstanceHealth(instanceName: string): Promise<HealthStatus> {
    try {
      const instance = await this.instanceManager.getInstance(instanceName);

      if (!instance) {
        throw new Error(`Instance ${instanceName} not found`);
      }

      const { health } = instance;

      // Cache health status in Redis
      await this.redisCache.setHealth(instanceName, health);

      // Get previous health status to detect changes
      const previousStatus = await this.redisCache.getHealth(instanceName);

      // Emit event if health status changed
      if (previousStatus && previousStatus.overall !== health.overall) {
        this.emit('health:changed', {
          instanceName,
          previous: previousStatus.overall,
          current: health.overall,
          timestamp: new Date()
        });

        logger.info(`Health status changed for ${instanceName}: ${previousStatus.overall} -> ${health.overall}`);

        // Emit alert if status degraded
        if (health.overall === 'unhealthy' || health.overall === 'degraded') {
          this.emit('alert:triggered', {
            instanceName,
            type: 'health_degraded',
            message: `Instance ${instanceName} health is ${health.overall}`,
            severity: health.overall === 'unhealthy' ? 'critical' : 'warning',
            timestamp: new Date()
          });
        }
      }

      return health;
    } catch (error) {
      logger.error(`Error checking health for ${instanceName}:`, error);

      const errorHealth: HealthStatus = {
        overall: 'unhealthy',
        healthyServices: 0,
        totalServices: 0,
        lastChecked: new Date()
      };

      return errorHealth;
    }
  }

  /**
   * Get cached health status for an instance
   */
  async getCachedHealth(instanceName: string): Promise<HealthStatus | null> {
    return await this.redisCache.getHealth(instanceName);
  }

  /**
   * Force refresh health for an instance
   */
  async refreshInstanceHealth(instanceName: string): Promise<HealthStatus> {
    return await this.checkInstanceHealth(instanceName);
  }
}

export default HealthMonitor;
