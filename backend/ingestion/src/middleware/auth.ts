/**
 * Fastify JWT authentication middleware
 * Registers JWT plugin and decorates request with user context
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, extractTokenFromHeader } from './jwt.service';
import { UserContext } from './auth.types';

/**
 * Extend FastifyRequest with user context
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
  }
}

/**
 * Initialize JWT authentication middleware
 */
export async function initializeJWTAuth(app: FastifyInstance): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required for authentication');
  }

  // Add custom authentication hook
  app.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public endpoints
    if (isPublicEndpoint(request.url)) {
      return;
    }

    try {
      // Extract token from Authorization header
      const token = extractTokenFromHeader(request.headers.authorization);
      if (!token) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing Authorization header',
        });
      }

      // Verify token
      const payload = verifyAccessToken(token);

      // Attach user context to request
      request.user = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        accountIds: payload.accountIds,
        roles: payload.roles,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      return reply.status(401).send({
        error: 'Unauthorized',
        message,
      });
    }
  });
}

/**
 * Check if endpoint is public (doesn't require authentication)
 */
function isPublicEndpoint(url: string): boolean {
  const publicEndpoints = [
    '/health',
    '/health/db',
    '/auth/login',
    '/auth/refresh',
    '/auth/register', // Can be made private later
  ];

  // Check exact matches
  if (publicEndpoints.includes(url)) {
    return true;
  }

  // Check path prefixes
  for (const endpoint of publicEndpoints) {
    if (url.startsWith(endpoint)) {
      return true;
    }
  }

  return false;
}

/**
 * Require authentication middleware (for route-level protection)
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
}

/**
 * Require specific roles middleware
 */
export function requireRoles(...roles: Array<'ADMIN' | 'VIEWER' | 'AUDITOR'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const hasRole = request.user.roles.some((role: string) =>
      roles.includes(role as 'ADMIN' | 'VIEWER' | 'AUDITOR')
    );
    if (!hasRole) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Requires one of the following roles: ${roles.join(', ')}`,
      });
    }
  };
}

/**
 * Get user context from request
 * Throws if user not authenticated
 */
export function getUserContext(request: FastifyRequest): UserContext {
  if (!request.user) {
    throw new Error('User context not found. Ensure requireAuth middleware is applied.');
  }
  return request.user;
}
