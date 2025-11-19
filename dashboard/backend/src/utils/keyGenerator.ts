import crypto from 'crypto';
import { logger } from './logger';

/**
 * Generate a secure random string
 */
export function generateSecureRandom(length: number): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

/**
 * Generate a secure password
 */
export function generatePassword(length: number = 32): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

/**
 * Generate JWT secret
 */
export function generateJwtSecret(length: number = 48): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

/**
 * Generate JWT token with specific role
 * Ported from Python generate_keys.py
 */
export function generateJwtToken(secret: string, role: 'anon' | 'service_role'): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    role: role,
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
  };

  // Base64URL encode
  const base64UrlEncode = (obj: any): string => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Generate all keys for a new Supabase instance
 */
export interface GeneratedKeys {
  postgres_password: string;
  jwt_secret: string;
  anon_key: string;
  service_role_key: string;
  dashboard_username: string;
  dashboard_password: string;
  secret_key_base: string;
  vault_enc_key: string;
  logflare_api_key: string;
}

export function generateAllKeys(): GeneratedKeys {
  logger.info('Generating secure keys for new instance');

  const jwtSecret = generateJwtSecret(48);

  const keys: GeneratedKeys = {
    postgres_password: generatePassword(32),
    jwt_secret: jwtSecret,
    anon_key: generateJwtToken(jwtSecret, 'anon'),
    service_role_key: generateJwtToken(jwtSecret, 'service_role'),
    dashboard_username: `admin_${crypto.randomBytes(4).toString('hex')}`,
    dashboard_password: generatePassword(24),
    secret_key_base: generateSecureRandom(64),
    vault_enc_key: generateSecureRandom(32),
    logflare_api_key: crypto.randomBytes(16).toString('hex')
  };

  logger.info('Successfully generated all keys');
  return keys;
}

/**
 * Regenerate specific keys (for key rotation)
 */
export function regenerateKeys(currentJwtSecret?: string): Partial<GeneratedKeys> {
  const jwtSecret = currentJwtSecret || generateJwtSecret(48);

  return {
    jwt_secret: jwtSecret,
    anon_key: generateJwtToken(jwtSecret, 'anon'),
    service_role_key: generateJwtToken(jwtSecret, 'service_role')
  };
}
