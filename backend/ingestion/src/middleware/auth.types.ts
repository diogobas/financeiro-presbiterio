/**
 * Authentication types and interfaces
 */

/**
 * JWT payload structure
 */
export interface JWTPayload {
  /** User ID (from Account entity) */
  sub: string;
  /** User email */
  email: string;
  /** User full name */
  name: string;
  /** Account IDs the user has access to */
  accountIds: string[];
  /** User roles */
  roles: Array<'ADMIN' | 'VIEWER' | 'AUDITOR'>;
  /** Token issued at */
  iat: number;
  /** Token expiration */
  exp: number;
}

/**
 * Decoded JWT with FastifyJWT
 */
export interface DecodedToken {
  payload: JWTPayload;
  signature: string;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  /** User ID */
  sub: string;
  /** Token issued at */
  iat: number;
  /** Token expiration */
  exp: number;
}

/**
 * Login credentials
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response with tokens
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  accessToken: string;
  expiresIn: number;
}

/**
 * User context injected into requests
 */
export interface UserContext {
  userId: string;
  email: string;
  name: string;
  accountIds: string[];
  roles: Array<'ADMIN' | 'VIEWER' | 'AUDITOR'>;
}
