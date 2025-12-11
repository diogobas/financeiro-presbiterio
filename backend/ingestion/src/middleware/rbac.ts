/**
 * Role-Based Access Control (RBAC) middleware
 * Provides authorization guards for different user roles
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { UserContext } from './auth.types';

/**
 * Valid user roles
 */
export type UserRole = 'ADMIN' | 'VIEWER' | 'AUDITOR';

/**
 * Role hierarchy for permission checking
 * ADMIN can do everything
 * AUDITOR can audit and view
 * VIEWER can only view
 */
const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  ADMIN: ['ADMIN', 'AUDITOR', 'VIEWER'],
  AUDITOR: ['AUDITOR', 'VIEWER'],
  VIEWER: ['VIEWER'],
};

/**
 * Check if user has required role(s)
 */
function hasRole(userRoles: string[], requiredRoles: UserRole[]): boolean {
  return userRoles.some((role) => requiredRoles.includes(role as UserRole));
}

/**
 * Check if user has required role or higher
 */
function hasRoleOrHigher(userRoles: string[], minimumRole: UserRole): boolean {
  for (const userRole of userRoles) {
    const hierarchy = ROLE_HIERARCHY[userRole as UserRole];
    if (hierarchy && hierarchy.includes(minimumRole)) {
      return true;
    }
  }
  return false;
}

/**
 * Middleware to require one or more specific roles
 * Usage: app.post('/admin', requireRoles('ADMIN'), handler)
 */
export function requireRoles(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!hasRole(user.roles, roles)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Requires one of the following roles: ${roles.join(', ')}`,
      });
    }
  };
}

/**
 * Middleware to require minimum role level
 * Usage: app.post('/audit', requireMinimumRole('AUDITOR'), handler)
 */
export function requireMinimumRole(minimumRole: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!hasRoleOrHigher(user.roles, minimumRole)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Requires ${minimumRole} role or higher`,
      });
    }
  };
}

/**
 * Middleware to require access to specific account
 * User must either be ADMIN or have account in accountIds
 * Usage: app.post('/accounts/:id', requireAccountAccess(), handler)
 */
export function requireAccountAccess() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Extract account ID from URL parameters
    const accountId =
      (request.params as Record<string, string>)?.id ||
      (request.params as Record<string, string>)?.accountId ||
      (request.query as Record<string, string>)?.accountId;

    // ADMIN has access to all accounts
    if (user.roles.includes('ADMIN')) {
      return;
    }

    // Check if user has access to this specific account
    if (accountId && !user.accountIds.includes(accountId)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this account',
      });
    }
  };
}

/**
 * Middleware to ensure user can only access their own data
 * ADMIN can access all, others can only access themselves
 * Usage: app.get('/profile/:userId', requireSelfOrAdmin(), handler)
 */
export function requireSelfOrAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const targetUserId =
      (request.params as Record<string, string>)?.userId ||
      (request.params as Record<string, string>)?.id;

    // ADMIN can access all users
    if (user.roles.includes('ADMIN')) {
      return;
    }

    // Non-admin users can only access themselves
    if (targetUserId && user.userId !== targetUserId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only access your own data',
      });
    }
  };
}

/**
 * Get user's effective permissions based on their roles
 */
export function getUserPermissions(user: UserContext): Set<string> {
  const permissions = new Set<string>();

  for (const role of user.roles) {
    switch (role) {
      case 'ADMIN':
        // Admin has all permissions
        permissions.add('accounts:create');
        permissions.add('accounts:read');
        permissions.add('accounts:update');
        permissions.add('accounts:delete');
        permissions.add('imports:create');
        permissions.add('imports:read');
        permissions.add('imports:delete');
        permissions.add('rules:create');
        permissions.add('rules:read');
        permissions.add('rules:update');
        permissions.add('rules:delete');
        permissions.add('transactions:read');
        permissions.add('transactions:classify');
        permissions.add('transactions:override');
        permissions.add('overrides:read');
        permissions.add('overrides:delete');
        permissions.add('reports:read');
        break;

      case 'AUDITOR':
        // Auditor can read, override, and view audit
        permissions.add('accounts:read');
        permissions.add('imports:read');
        permissions.add('rules:read');
        permissions.add('transactions:read');
        permissions.add('transactions:override');
        permissions.add('overrides:read');
        permissions.add('overrides:delete');
        permissions.add('reports:read');
        break;

      case 'VIEWER':
        // Viewer can only read
        permissions.add('accounts:read');
        permissions.add('imports:read');
        permissions.add('rules:read');
        permissions.add('transactions:read');
        permissions.add('overrides:read');
        permissions.add('reports:read');
        break;
    }
  }

  return permissions;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: UserContext, permission: string): boolean {
  const permissions = getUserPermissions(user);
  return permissions.has(permission);
}
