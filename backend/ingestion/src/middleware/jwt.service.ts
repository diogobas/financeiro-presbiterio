/**
 * JWT token service for creating and verifying tokens
 */

import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { JWTPayload, RefreshTokenPayload } from './auth.types';

/**
 * Get JWT signing key from environment
 */
export function getSigningKey(): string {
  const key = process.env.JWT_SECRET;
  if (!key) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return key;
}

/**
 * Get refresh token signing key from environment
 */
export function getRefreshSigningKey(): string {
  const key = process.env.JWT_REFRESH_SECRET;
  if (!key) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  return key;
}

/**
 * Get access token expiry from environment (default: 15 minutes)
 */
export function getAccessTokenExpiry(): string {
  return process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
}

/**
 * Get refresh token expiry from environment (default: 7 days)
 */
export function getRefreshTokenExpiry(): string {
  return process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';
}

/**
 * Create an access token
 */
export function createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const signingKey = getSigningKey();
  const expiresIn = getAccessTokenExpiry();

  return jwt.sign(payload, signingKey, {
    expiresIn: expiresIn as unknown as string,
    algorithm: 'HS256',
  } as SignOptions);
}

/**
 * Create a refresh token
 */
export function createRefreshToken(userId: string): string {
  const signingKey = getRefreshSigningKey();
  const expiresIn = getRefreshTokenExpiry();

  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
  };

  return jwt.sign(payload, signingKey, {
    expiresIn: expiresIn as unknown as string,
    algorithm: 'HS256',
  } as SignOptions);
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  const signingKey = getSigningKey();

  const verifyOptions: VerifyOptions = {
    algorithms: ['HS256'],
  };

  try {
    const decoded = jwt.verify(token, signingKey, verifyOptions) as JWTPayload;
    return decoded;
  } catch (err) {
    throw new Error(
      `Invalid or expired access token: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const signingKey = getRefreshSigningKey();

  const verifyOptions: VerifyOptions = {
    algorithms: ['HS256'],
  };

  try {
    const decoded = jwt.verify(token, signingKey, verifyOptions) as RefreshTokenPayload;
    return decoded;
  } catch (err) {
    throw new Error(
      `Invalid or expired refresh token: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract token from Authorization header
 * Expected format: Bearer <token>
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * JWTService class wrapper for dependency injection in tests
 */
export class JWTService {
  createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return createAccessToken(payload);
  }

  createRefreshToken(userId: string): string {
    return createRefreshToken(userId);
  }

  verifyAccessToken(token: string): JWTPayload {
    return verifyAccessToken(token);
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return verifyRefreshToken(token);
  }

  extractTokenFromHeader(authHeader?: string): string | null {
    return extractTokenFromHeader(authHeader);
  }

  getSigningKey(): string {
    return getSigningKey();
  }

  getRefreshSigningKey(): string {
    return getRefreshSigningKey();
  }

  getAccessTokenExpiry(): string {
    return getAccessTokenExpiry();
  }

  getRefreshTokenExpiry(): string {
    return getRefreshTokenExpiry();
  }
}
