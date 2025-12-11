/**
 * Example routes demonstrating RBAC usage
 * Shows how to use role-based guards with Fastify
 */

import { FastifyInstance } from 'fastify';
import { requireAuth, getUserContext } from '../middleware/auth';
import {
  requireRoles,
  requireMinimumRole,
  requireAccountAccess,
  requireSelfOrAdmin,
  hasPermission,
} from '../middleware/rbac';

export async function registerRBACExampleRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Admin-only endpoint
   * Usage: POST /api/v1/admin/users
   */
  app.post(
    '/api/v1/admin/users',
    { preValidation: [requireAuth, requireRoles('ADMIN')] },
    async (request, reply) => {
      const user = getUserContext(request);
      return reply.code(200).send({
        message: 'User created successfully',
        createdBy: user?.userId,
      });
    }
  );

  /**
   * Auditor+ endpoint (ADMIN or AUDITOR)
   * Usage: POST /api/v1/audit/overrides
   */
  app.post(
    '/api/v1/audit/overrides',
    { preValidation: [requireAuth, requireMinimumRole('AUDITOR')] },
    async (request, reply) => {
      const user = getUserContext(request);
      return reply.code(200).send({
        message: 'Override approved',
        approvedBy: user?.email,
      });
    }
  );

  /**
   * Viewer+ endpoint (any authenticated user)
   * Also validates access to specific account
   * Usage: GET /api/v1/reports/:accountId
   */
  app.get(
    '/api/v1/reports/:accountId',
    { preValidation: [requireAuth, requireAccountAccess()] },
    async (request, reply) => {
      const { accountId } = request.params as Record<string, string>;
      const user = getUserContext(request);

      return reply.code(200).send({
        accountId,
        accessedBy: user?.email,
        userRoles: user?.roles,
      });
    }
  );

  /**
   * Permission-based authorization
   * Usage: GET /api/v1/transactions/:transactionId
   */
  app.get(
    '/api/v1/transactions/:transactionId',
    { preValidation: [requireAuth] },
    async (request, reply) => {
      const { transactionId } = request.params as Record<string, string>;
      const user = getUserContext(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Manual permission check
      if (!hasPermission(user, 'transactions:read')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to read transactions',
        });
      }

      const canClassify = hasPermission(user, 'transactions:classify');

      return reply.code(200).send({
        transactionId,
        canRead: true,
        canClassify,
      });
    }
  );

  /**
   * Self-only access endpoint
   * Users can only access their own profile, except ADMIN
   * Usage: GET /api/v1/profile/:userId
   */
  app.get(
    '/api/v1/profile/:userId',
    { preValidation: [requireAuth, requireSelfOrAdmin()] },
    async (request, reply) => {
      const { userId } = request.params as Record<string, string>;
      const user = getUserContext(request);

      return reply.code(200).send({
        userId,
        email: user?.email,
        roles: user?.roles,
      });
    }
  );

  /**
   * Combination of checks
   * Usage: PATCH /api/v1/accounts/:id
   */
  app.patch(
    '/api/v1/accounts/:id',
    {
      preValidation: [
        requireAuth,
        requireMinimumRole('ADMIN'), // Requires ADMIN or higher
        requireAccountAccess(), // Also check account access
      ],
    },
    async (request, reply) => {
      const { id } = request.params as Record<string, string>;
      const user = getUserContext(request);

      return reply.code(200).send({
        accountId: id,
        updatedBy: user?.userId,
        message: 'Account updated successfully',
      });
    }
  );

  /**
   * Classification endpoint
   * Only ADMIN and AUDITOR can classify
   * Usage: POST /api/v1/transactions/:id/classify
   */
  app.post(
    '/api/v1/transactions/:id/classify',
    { preValidation: [requireAuth, requireMinimumRole('AUDITOR')] },
    async (request, reply) => {
      const { id } = request.params as Record<string, string>;
      const user = getUserContext(request);

      // Additional permission check
      if (!hasPermission(user, 'transactions:classify')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to classify transactions',
        });
      }

      return reply.code(200).send({
        transactionId: id,
        classifiedBy: user?.email,
        message: 'Transaction classified',
      });
    }
  );

  /**
   * Public endpoint (no auth required)
   * Usage: GET /health
   */
  app.get('/health', async (request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });
}
