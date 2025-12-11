/**
 * Unit tests for JWT service
 */

import { JWTService } from '../../src/middleware/jwt.service';

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    // Initialize with test environment variables
    process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long!!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-minimum-32-characters!';
    process.env.JWT_ACCESS_TOKEN_EXPIRY = '1h'; // Use proper duration format
    process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

    jwtService = new JWTService();
  });

  describe('createAccessToken', () => {
    it('should create a valid access token', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        accountIds: ['account-1'],
        roles: ['VIEWER'],
      } as unknown as Omit<import('../../src/middleware/auth.types').JWTPayload, 'iat' | 'exp'>;

      const token = jwtService.createAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should create tokens with different payloads that are different', () => {
      const payload1 = {
        sub: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        accountIds: ['account-1'],
        roles: ['VIEWER'],
      } as unknown as Omit<import('../../src/middleware/auth.types').JWTPayload, 'iat' | 'exp'>;

      const payload2 = {
        sub: 'user-2',
        email: 'user2@example.com',
        name: 'User Two',
        accountIds: ['account-2'],
        roles: ['ADMIN'],
      } as unknown as Omit<import('../../src/middleware/auth.types').JWTPayload, 'iat' | 'exp'>;

      const token1 = jwtService.createAccessToken(payload1);
      const token2 = jwtService.createAccessToken(payload2);

      expect(token1).not.toBe(token2);
    });
  });

  describe('createRefreshToken', () => {
    it('should create a valid refresh token', () => {
      const token = jwtService.createRefreshToken('user-123');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid access token', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        accountIds: ['account-1'],
        roles: ['VIEWER'],
      } as unknown as Omit<import('../../src/middleware/auth.types').JWTPayload, 'iat' | 'exp'>;

      const token = jwtService.createAccessToken(payload);
      const decoded = jwtService.verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.roles).toEqual(payload.roles);
    });

    it('should throw on invalid token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should throw on tampered token', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        accountIds: ['account-1'],
        roles: ['VIEWER'],
      } as unknown as Omit<import('../../src/middleware/auth.types').JWTPayload, 'iat' | 'exp'>;

      const token = jwtService.createAccessToken(payload);
      const tampered = token.split('.').slice(0, 2).join('.') + '.tampered';

      expect(() => {
        jwtService.verifyAccessToken(tampered);
      }).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and decode a valid refresh token', () => {
      const userId = 'user-123';
      const token = jwtService.createRefreshToken(userId);
      const decoded = jwtService.verifyRefreshToken(token);

      expect(decoded.sub).toBe(userId);
    });

    it('should throw on invalid refresh token', () => {
      expect(() => {
        jwtService.verifyRefreshToken('invalid-token');
      }).toThrow();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;

      const extracted = jwtService.extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should return null for missing Bearer prefix', () => {
      const header = 'test-token-123';
      const extracted = jwtService.extractTokenFromHeader(header);

      expect(extracted).toBeNull();
    });

    it('should return null for empty header', () => {
      const extracted = jwtService.extractTokenFromHeader('');
      expect(extracted).toBeNull();
    });

    it('should handle case-insensitive Bearer', () => {
      const token = 'test-token-123';
      const header = `bearer ${token}`;

      const extracted = jwtService.extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });
  });
});
