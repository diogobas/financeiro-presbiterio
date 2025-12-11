/**
 * Test utilities and mocks for authentication and RBAC
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { UserContext } from '../middleware/auth.types';

/**
 * Create a mock FastifyRequest with user context
 */
export function createMockRequest(userContext?: UserContext): Partial<FastifyRequest> {
  return {
    user: userContext,
    params: {},
    query: {},
  } as Partial<FastifyRequest>;
}

/**
 * Create a mock FastifyReply
 */
export function createMockReply(): Partial<FastifyReply> {
  const statusCodes: Record<string, number> = {};

  return {
    status: (code: number) => {
      statusCodes.current = code;
      return {
        send: (data: any) => data,
      };
    },
    code: (code: number) => {
      statusCodes.current = code;
      return {
        send: (data: any) => data,
      };
    },
  } as Partial<FastifyReply>;
}

/**
 * Create a test user context
 */
export function createTestUser(overrides?: Partial<UserContext>): UserContext {
  return {
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    accountIds: ['account-1', 'account-2'],
    roles: ['VIEWER'],
    ...overrides,
  };
}

/**
 * Create an admin user for testing
 */
export function createAdminUser(overrides?: Partial<UserContext>): UserContext {
  return createTestUser({
    roles: ['ADMIN'],
    ...overrides,
  });
}

/**
 * Create an auditor user for testing
 */
export function createAuditorUser(overrides?: Partial<UserContext>): UserContext {
  return createTestUser({
    roles: ['AUDITOR'],
    ...overrides,
  });
}

/**
 * Create a viewer user for testing
 */
export function createViewerUser(overrides?: Partial<UserContext>): UserContext {
  return createTestUser({
    roles: ['VIEWER'],
    ...overrides,
  });
}
