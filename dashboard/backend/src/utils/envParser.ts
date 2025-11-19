import fs from 'fs';
import path from 'path';
import { EnvConfig, InstanceCredentials, PortMapping } from '../types';
import { logger } from './logger';

/**
 * Parse a .env file and return key-value pairs
 */
export function parseEnvFile(filePath: string): EnvConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config: EnvConfig = {};

    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        return;
      }

      // Parse KEY=VALUE
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove surrounding quotes if present
        value = value.replace(/^["']|["']$/g, '');

        config[key] = value;
      }
    });

    return config;
  } catch (error) {
    logger.error(`Error parsing env file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extract credentials from env config
 */
export function extractCredentials(envConfig: EnvConfig): InstanceCredentials {
  return {
    project_url: envConfig.API_EXTERNAL_URL || envConfig.PUBLIC_REST_URL || '',
    anon_key: envConfig.ANON_KEY || '',
    service_role_key: envConfig.SERVICE_ROLE_KEY || '',
    postgres_password: envConfig.POSTGRES_PASSWORD || '',
    jwt_secret: envConfig.JWT_SECRET || '',
    dashboard_username: envConfig.DASHBOARD_USERNAME || '',
    dashboard_password: envConfig.DASHBOARD_PASSWORD || ''
  };
}

/**
 * Extract port mappings from env config
 */
export function extractPorts(envConfig: EnvConfig): PortMapping {
  // Extract port from host:port format
  const extractPort = (value: string): number => {
    if (!value) return 0;
    const match = value.match(/:(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    kong_http: extractPort(envConfig.KONG_HTTP_PORT || '8000'),
    kong_https: extractPort(envConfig.KONG_HTTPS_PORT || '8443'),
    studio: extractPort(envConfig.STUDIO_PORT || '3000'),
    postgres: extractPort(envConfig.POSTGRES_PORT || '5432'),
    pooler: extractPort(envConfig.POOLER_PORT || '6543'),
    analytics: extractPort(envConfig.ANALYTICS_PORT || '4000')
  };
}

/**
 * Write env config back to file
 */
export function writeEnvFile(filePath: string, config: EnvConfig): void {
  try {
    const lines: string[] = [];

    Object.entries(config).forEach(([key, value]) => {
      // Quote values that contain spaces or special characters
      const quotedValue = value.includes(' ') || value.includes('#')
        ? `"${value}"`
        : value;
      lines.push(`${key}=${quotedValue}`);
    });

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    logger.info(`Wrote env file: ${filePath}`);
  } catch (error) {
    logger.error(`Error writing env file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Create backup of env file
 */
export function backupEnvFile(filePath: string): string {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.bak.${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    logger.info(`Created backup: ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error(`Error creating backup of ${filePath}:`, error);
    throw error;
  }
}
