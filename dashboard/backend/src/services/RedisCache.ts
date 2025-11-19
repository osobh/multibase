import Redis from 'ioredis';
import { HealthStatus, ResourceMetrics } from '../types';
import { logger } from '../utils/logger';

export class RedisCache {
  private redis: Redis;
  private readonly HEALTH_PREFIX = 'health:';
  private readonly METRICS_PREFIX = 'metrics:';
  private readonly DEFAULT_TTL = 30; // seconds

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Set health status for an instance
   */
  async setHealth(instanceName: string, health: HealthStatus): Promise<void> {
    try {
      const key = `${this.HEALTH_PREFIX}${instanceName}`;
      await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(health));
    } catch (error) {
      logger.error(`Error setting health for ${instanceName}:`, error);
    }
  }

  /**
   * Get health status for an instance
   */
  async getHealth(instanceName: string): Promise<HealthStatus | null> {
    try {
      const key = `${this.HEALTH_PREFIX}${instanceName}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as HealthStatus;
    } catch (error) {
      logger.error(`Error getting health for ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Set latest metrics for an instance service
   */
  async setMetrics(instanceName: string, serviceName: string, metrics: ResourceMetrics): Promise<void> {
    try {
      const key = `${this.METRICS_PREFIX}${instanceName}:${serviceName}`;
      await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(metrics));
    } catch (error) {
      logger.error(`Error setting metrics for ${instanceName}:${serviceName}:`, error);
    }
  }

  /**
   * Get latest metrics for an instance service
   */
  async getMetrics(instanceName: string, serviceName: string): Promise<ResourceMetrics | null> {
    try {
      const key = `${this.METRICS_PREFIX}${instanceName}:${serviceName}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as ResourceMetrics;
    } catch (error) {
      logger.error(`Error getting metrics for ${instanceName}:${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Get all metrics for an instance
   */
  async getAllMetrics(instanceName: string): Promise<Map<string, ResourceMetrics>> {
    try {
      const pattern = `${this.METRICS_PREFIX}${instanceName}:*`;
      const keys = await this.redis.keys(pattern);
      const metricsMap = new Map<string, ResourceMetrics>();

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const serviceName = key.replace(`${this.METRICS_PREFIX}${instanceName}:`, '');
          metricsMap.set(serviceName, JSON.parse(data) as ResourceMetrics);
        }
      }

      return metricsMap;
    } catch (error) {
      logger.error(`Error getting all metrics for ${instanceName}:`, error);
      return new Map();
    }
  }

  /**
   * Set a generic key-value pair
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      logger.error(`Error setting key ${key}:`, error);
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Error deleting key ${key}:`, error);
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.redis.publish(channel, message);
    } catch (error) {
      logger.error(`Error publishing to channel ${channel}:`, error);
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, callback: (message: string) => void): void {
    const subscriber = this.redis.duplicate();

    subscriber.subscribe(channel, (err) => {
      if (err) {
        logger.error(`Error subscribing to channel ${channel}:`, err);
      } else {
        logger.info(`Subscribed to channel: ${channel}`);
      }
    });

    subscriber.on('message', (chan, message) => {
      if (chan === channel) {
        callback(message);
      }
    });
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('Closed Redis connection');
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  /**
   * Ping Redis
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }
}

export default RedisCache;
