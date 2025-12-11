package org.example.financeiro.reporting.security

/**
 * JWT token claims and payload structures
 */

/**
 * JWT Payload structure
 */
data class JWTPayload(
    /** User ID (from Account entity) */
    val sub: String,
    /** User email */
    val email: String,
    /** User full name */
    val name: String,
    /** Account IDs the user has access to */
    val accountIds: List<String>,
    /** User roles */
    val roles: List<String>,
    /** Token issued at */
    val iat: Long,
    /** Token expiration */
    val exp: Long,
)

/**
 * User context information extracted from JWT
 */
data class UserContext(
    /** User ID */
    val userId: String,
    /** User email */
    val email: String,
    /** User full name */
    val name: String,
    /** Account IDs the user has access to */
    val accountIds: List<String>,
    /** User roles */
    val roles: List<String>,
)

/**
 * Login request payload
 */
data class LoginRequest(
    val email: String,
    val password: String,
)

/**
 * Login response with tokens
 */
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val user: UserInfo,
) {
    data class UserInfo(
        val id: String,
        val email: String,
        val name: String,
        val roles: List<String>,
    )
}

/**
 * Token refresh request
 */
data class RefreshTokenRequest(
    val refreshToken: String,
)

/**
 * Token refresh response
 */
data class TokenRefreshResponse(
    val accessToken: String,
    val expiresIn: Long,
)
