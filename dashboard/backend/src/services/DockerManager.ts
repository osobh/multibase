import Docker from 'dockerode';
import { DockerContainerInfo, ContainerStats, ServiceStatus, ResourceMetrics } from '../types';
import { logger } from '../utils/logger';

export class DockerManager {
  private docker: Docker;

  constructor(socketPath?: string) {
    const dockerOptions: Docker.DockerOptions = socketPath
      ? { socketPath }
      : process.env.DOCKER_HOST
      ? { host: process.env.DOCKER_HOST.replace('tcp://', ''), port: 2375 }
      : { socketPath: '/var/run/docker.sock' };

    this.docker = new Docker(dockerOptions);
  }

  /**
   * List all containers for a specific project
   */
  async listProjectContainers(projectName: string): Promise<Docker.ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.filter(container =>
        container.Names.some(name => name.includes(projectName))
      );
    } catch (error) {
      logger.error(`Error listing containers for project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Get container stats for resource metrics
   */
  async getContainerStats(containerId: string): Promise<ResourceMetrics | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false }) as unknown as ContainerStats;

      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage -
                      stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage -
                         stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) *
                        (stats.cpu_stats.online_cpus || 1) * 100;

      // Memory in MB
      const memoryMB = stats.memory_stats.usage / (1024 * 1024);

      // Network stats
      let networkRx = 0;
      let networkTx = 0;
      if (stats.networks) {
        Object.values(stats.networks).forEach(network => {
          networkRx += network.rx_bytes;
          networkTx += network.tx_bytes;
        });
      }

      // Disk I/O
      let diskRead = 0;
      let diskWrite = 0;
      if (stats.blkio_stats.io_service_bytes_recursive) {
        stats.blkio_stats.io_service_bytes_recursive.forEach(io => {
          if (io.op === 'Read') diskRead += io.value;
          if (io.op === 'Write') diskWrite += io.value;
        });
      }

      return {
        cpu: parseFloat(cpuPercent.toFixed(2)),
        memory: parseFloat(memoryMB.toFixed(2)),
        networkRx,
        networkTx,
        diskRead,
        diskWrite,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Error getting stats for container ${containerId}:`, error);
      return null;
    }
  }

  /**
   * Get service status for a project
   */
  async getServiceStatus(projectName: string): Promise<ServiceStatus[]> {
    try {
      const containers = await this.listProjectContainers(projectName);

      // Parallelize container inspection and stats gathering
      const serviceStatusPromises = containers.map(async (container) => {
        const containerName = container.Names[0].replace('/', '');
        const serviceName = this.extractServiceName(containerName, projectName);

        // Get detailed container info for health status
        const containerObj = this.docker.getContainer(container.Id);
        const inspect = await containerObj.inspect();

        // Determine health status
        let health: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
        if (inspect.State.Health) {
          health = inspect.State.Health.Status === 'healthy' ? 'healthy' : 'unhealthy';
        } else if (inspect.State.Running) {
          health = 'healthy';
        }

        // Get uptime
        const startedAt = new Date(inspect.State.StartedAt);
        const uptime = inspect.State.Running
          ? Math.floor((Date.now() - startedAt.getTime()) / 1000)
          : 0;

        // Get resource metrics (parallelize with inspect if running)
        const metrics = inspect.State.Running
          ? await this.getContainerStats(container.Id)
          : null;

        return {
          name: serviceName,
          containerName,
          status: inspect.State.Running ? 'running' : 'stopped',
          health,
          uptime,
          cpu: metrics?.cpu || 0,
          memory: metrics?.memory || 0
        };
      });

      const serviceStatuses = await Promise.all(serviceStatusPromises);
      return serviceStatuses;
    } catch (error) {
      logger.error(`Error getting service status for ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Extract service name from container name
   * Example: "popupcash-kong" -> "kong"
   * Special case: "realtime-dev.popupcash-realtime" -> "realtime"
   */
  private extractServiceName(containerName: string, projectName: string): string {
    // Handle special realtime case
    if (containerName.includes('realtime-dev.')) {
      return 'realtime';
    }

    // Standard format: {project}-{service}
    const parts = containerName.split('-');
    const projectIndex = parts.indexOf(projectName);

    if (projectIndex !== -1 && projectIndex < parts.length - 1) {
      return parts.slice(projectIndex + 1).join('-');
    }

    return containerName;
  }

  /**
   * Start a project's containers
   */
  async startProject(projectName: string): Promise<void> {
    try {
      const containers = await this.listProjectContainers(projectName);

      for (const container of containers) {
        const containerObj = this.docker.getContainer(container.Id);
        const inspect = await containerObj.inspect();

        if (!inspect.State.Running) {
          await containerObj.start();
          logger.info(`Started container: ${container.Names[0]}`);
        }
      }
    } catch (error) {
      logger.error(`Error starting project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Stop a project's containers
   */
  async stopProject(projectName: string): Promise<void> {
    try {
      const containers = await this.listProjectContainers(projectName);

      for (const container of containers) {
        const containerObj = this.docker.getContainer(container.Id);
        const inspect = await containerObj.inspect();

        if (inspect.State.Running) {
          await containerObj.stop();
          logger.info(`Stopped container: ${container.Names[0]}`);
        }
      }
    } catch (error) {
      logger.error(`Error stopping project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Restart a project's containers
   */
  async restartProject(projectName: string): Promise<void> {
    try {
      const containers = await this.listProjectContainers(projectName);

      for (const container of containers) {
        const containerObj = this.docker.getContainer(container.Id);
        await containerObj.restart();
        logger.info(`Restarted container: ${container.Names[0]}`);
      }
    } catch (error) {
      logger.error(`Error restarting project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Restart a specific service container
   */
  async restartService(projectName: string, serviceName: string): Promise<void> {
    try {
      const containers = await this.listProjectContainers(projectName);
      const container = containers.find(c =>
        this.extractServiceName(c.Names[0].replace('/', ''), projectName) === serviceName
      );

      if (!container) {
        throw new Error(`Service ${serviceName} not found for project ${projectName}`);
      }

      const containerObj = this.docker.getContainer(container.Id);
      await containerObj.restart();
      logger.info(`Restarted service: ${serviceName} for project ${projectName}`);
    } catch (error) {
      logger.error(`Error restarting service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerId: string,
    options: { tail?: number; since?: number; timestamps?: boolean } = {}
  ): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        since: options.since,
        timestamps: options.timestamps !== false
      });

      return logs.toString('utf8');
    } catch (error) {
      logger.error(`Error getting logs for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Stream container logs
   */
  async streamContainerLogs(
    containerId: string,
    callback: (chunk: string) => void
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: true
      });

      stream.on('data', (chunk: Buffer) => {
        callback(chunk.toString('utf8'));
      });

      stream.on('error', (error: Error) => {
        logger.error(`Error streaming logs for container ${containerId}:`, error);
      });
    } catch (error) {
      logger.error(`Error setting up log stream for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Remove project containers
   */
  async removeProjectContainers(projectName: string, removeVolumes: boolean = false): Promise<void> {
    try {
      const containers = await this.listProjectContainers(projectName);

      for (const container of containers) {
        const containerObj = this.docker.getContainer(container.Id);
        const inspect = await containerObj.inspect();

        if (inspect.State.Running) {
          await containerObj.stop();
        }

        await containerObj.remove({ v: removeVolumes });
        logger.info(`Removed container: ${container.Names[0]}`);
      }
    } catch (error) {
      logger.error(`Error removing containers for project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Check Docker connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.error('Docker ping failed:', error);
      return false;
    }
  }
}

export default DockerManager;
