package org.example.financeiro.reporting.security

import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.security.Keys
import java.util.Date
import javax.crypto.SecretKey
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * JWT token provider for creating and validating tokens
 */
@Component
class JWTProvider(
    @Value("\${jwt.secret:#{null}}")
    private val jwtSecret: String?,
    @Value("\${jwt.refresh-secret:#{null}}")
    private val jwtRefreshSecret: String?,
    @Value("\${jwt.access-token-expiry:900000}")
    private val accessTokenExpiry: Long,
    @Value("\${jwt.refresh-token-expiry:604800000}")
    private val refreshTokenExpiry: Long,
) {
    private val signingKey: SecretKey by lazy {
        val secret = jwtSecret ?: throw IllegalArgumentException("JWT_SECRET environment variable is required")
        Keys.hmacShaKeyFor(secret.toByteArray())
    }

    private val refreshSigningKey: SecretKey by lazy {
        val secret =
            jwtRefreshSecret
                ?: throw IllegalArgumentException("JWT_REFRESH_SECRET environment variable is required")
        Keys.hmacShaKeyFor(secret.toByteArray())
    }

    /**
     * Create an access token
     */
    fun createAccessToken(
        userId: String,
        email: String,
        name: String,
        accountIds: List<String>,
        roles: List<String>,
    ): String {
        val now = Date()
        val expiryDate = Date(now.time + accessTokenExpiry)

        return Jwts.builder()
            .subject(userId)
            .claim("email", email)
            .claim("name", name)
            .claim("accountIds", accountIds)
            .claim("roles", roles)
            .issuedAt(now)
            .expiration(expiryDate)
            .signWith(signingKey, SignatureAlgorithm.HS256)
            .compact()
    }

    /**
     * Create a refresh token
     */
    fun createRefreshToken(userId: String): String {
        val now = Date()
        val expiryDate = Date(now.time + refreshTokenExpiry)

        return Jwts.builder()
            .subject(userId)
            .issuedAt(now)
            .expiration(expiryDate)
            .signWith(refreshSigningKey, SignatureAlgorithm.HS256)
            .compact()
    }

    /**
     * Extract user ID from access token
     */
    fun extractUserIdFromAccessToken(token: String): String? {
        return try {
            Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .payload
                .subject
        } catch (e: JwtException) {
            null
        }
    }

    /**
     * Extract user ID from refresh token
     */
    fun extractUserIdFromRefreshToken(token: String): String? {
        return try {
            Jwts.parser()
                .verifyWith(refreshSigningKey)
                .build()
                .parseSignedClaims(token)
                .payload
                .subject
        } catch (e: JwtException) {
            null
        }
    }

    /**
     * Extract JWT payload from access token
     */
    fun extractPayloadFromAccessToken(token: String): JWTPayload? {
        return try {
            val claims =
                Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .payload

            @Suppress("UNCHECKED_CAST")
            JWTPayload(
                sub = claims.subject,
                email = claims["email"] as String,
                name = claims["name"] as String,
                accountIds = claims["accountIds"] as List<String>,
                roles = claims["roles"] as List<String>,
                iat = claims.issuedAt.time,
                exp = claims.expiration.time,
            )
        } catch (e: JwtException) {
            null
        }
    }

    /**
     * Validate access token
     */
    fun validateAccessToken(token: String): Boolean {
        return try {
            Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
            true
        } catch (e: JwtException) {
            false
        }
    }

    /**
     * Validate refresh token
     */
    fun validateRefreshToken(token: String): Boolean {
        return try {
            Jwts.parser()
                .verifyWith(refreshSigningKey)
                .build()
                .parseSignedClaims(token)
            true
        } catch (e: JwtException) {
            false
        }
    }
}
