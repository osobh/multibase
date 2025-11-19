import net from 'net';
import { logger } from './logger';

/**
 * Check if a port is currently in use
 */
export function isPortInUse(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port, host);
  });
}

/**
 * Find an available port starting from basePort
 */
export async function findAvailablePort(basePort: number, maxTries: number = 1000): Promise<number> {
  let port = basePort;
  let tries = 0;

  while (tries < maxTries) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      logger.debug(`Found available port: ${port}`);
      return port;
    }
    port++;
    tries++;
  }

  throw new Error(`Could not find available port starting from ${basePort} after ${maxTries} attempts`);
}

/**
 * Calculate all required ports for a Supabase instance
 */
export async function calculatePorts(basePort: number): Promise<{
  kong_http: number;
  kong_https: number;
  studio: number;
  postgres: number;
  pooler: number;
  analytics: number;
}> {
  logger.info(`Calculating ports starting from base port ${basePort}`);

  const ports = {
    kong_http: await findAvailablePort(basePort),
    kong_https: await findAvailablePort(basePort + 443),
    studio: await findAvailablePort(basePort + 2000),
    postgres: await findAvailablePort(basePort + 1000),
    pooler: await findAvailablePort(basePort + 1001),
    analytics: await findAvailablePort(basePort + 3000)
  };

  logger.info('Port allocation complete:', ports);
  return ports;
}

/**
 * Get a random base port in a safe range
 */
export function getRandomBasePort(min: number = 3000, max: number = 9000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Validate port number
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}
