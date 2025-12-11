/**
 * Unit tests for RBAC utilities
 */

import {
  hasRole,
  hasRoleOrHigher,
  getUserPermissions,
  hasPermission,
} from '../../src/middleware/rbac';
import { UserContext } from '../../src/middleware/auth.types';

describe('RBAC Utilities', () => {
  describe('hasRole', () => {
    it('should return true if user has required role', () => {
      const roles = ['ADMIN', 'VIEWER'];
      expect(hasRole(roles, ['ADMIN'])).toBe(true);
    });

    it('should return true if user has any of multiple required roles', () => {
      const roles = ['VIEWER'];
      expect(hasRole(roles, ['ADMIN', 'VIEWER'])).toBe(true);
    });

    it('should return false if user does not have required role', () => {
      const roles = ['VIEWER'];
      expect(hasRole(roles, ['ADMIN'])).toBe(false);
    });
  });

  describe('hasRoleOrHigher', () => {
    it('ADMIN should have access to AUDITOR operations', () => {
      const roles = ['ADMIN'];
      expect(hasRoleOrHigher(roles, 'AUDITOR')).toBe(true);
    });

    it('AUDITOR should have access to VIEWER operations', () => {
      const roles = ['AUDITOR'];
      expect(hasRoleOrHigher(roles, 'VIEWER')).toBe(true);
    });

    it('VIEWER should not have access to AUDITOR operations', () => {
      const roles = ['VIEWER'];
      expect(hasRoleOrHigher(roles, 'AUDITOR')).toBe(false);
    });

    it('should handle multiple roles correctly', () => {
      const roles = ['VIEWER', 'AUDITOR'];
      expect(hasRoleOrHigher(roles, 'AUDITOR')).toBe(true);
    });
  });

  describe('getUserPermissions', () => {
    it('ADMIN should have all permissions', () => {
      const user: UserContext = {
        userId: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        accountIds: ['account-1'],
        roles: ['ADMIN'],
      };

      const permissions = getUserPermissions(user);

      expect(permissions.has('accounts:create')).toBe(true);
      expect(permissions.has('accounts:delete')).toBe(true);
      expect(permissions.has('rules:create')).toBe(true);
      expect(permissions.has('transactions:override')).toBe(true);
    });

    it('AUDITOR should have read + override permissions', () => {
      const user: UserContext = {
        userId: 'user-2',
        email: 'auditor@example.com',
        name: 'Auditor User',
        accountIds: ['account-1'],
        roles: ['AUDITOR'],
      };

      const permissions = getUserPermissions(user);

      expect(permissions.has('accounts:read')).toBe(true);
      expect(permissions.has('transactions:override')).toBe(true);
      expect(permissions.has('accounts:create')).toBe(false);
    });

    it('VIEWER should have read-only permissions', () => {
      const user: UserContext = {
        userId: 'user-3',
        email: 'viewer@example.com',
        name: 'Viewer User',
        accountIds: ['account-1'],
        roles: ['VIEWER'],
      };

      const permissions = getUserPermissions(user);

      expect(permissions.has('accounts:read')).toBe(true);
      expect(permissions.has('reports:read')).toBe(true);
      expect(permissions.has('accounts:create')).toBe(false);
      expect(permissions.has('transactions:override')).toBe(false);
    });

    it('should combine permissions from multiple roles', () => {
      const user: UserContext = {
        userId: 'user-4',
        email: 'multi@example.com',
        name: 'Multi Role User',
        accountIds: ['account-1'],
        roles: ['AUDITOR', 'VIEWER'],
      };

      const permissions = getUserPermissions(user);

      expect(permissions.has('accounts:read')).toBe(true);
      expect(permissions.has('transactions:override')).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', () => {
      const user: UserContext = {
        userId: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        accountIds: ['account-1'],
        roles: ['ADMIN'],
      };

      expect(hasPermission(user, 'accounts:create')).toBe(true);
    });

    it('should return false if user lacks permission', () => {
      const user: UserContext = {
        userId: 'user-3',
        email: 'viewer@example.com',
        name: 'Viewer User',
        accountIds: ['account-1'],
        roles: ['VIEWER'],
      };

      expect(hasPermission(user, 'accounts:create')).toBe(false);
    });

    it('should handle multiple roles', () => {
      const user: UserContext = {
        userId: 'user-2',
        email: 'auditor@example.com',
        name: 'Auditor User',
        accountIds: ['account-1'],
        roles: ['AUDITOR'],
      };

      expect(hasPermission(user, 'transactions:override')).toBe(true);
      expect(hasPermission(user, 'accounts:create')).toBe(false);
    });
  });
});
