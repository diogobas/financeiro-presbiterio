package org.example.financeiro.reporting.security

import jakarta.servlet.FilterChain
import jakarta.servlet.ServletException
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.io.IOException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter

/**
 * JWT authentication filter for Spring Security
 * Validates JWT tokens from Authorization header and sets user context
 */
class JWTAuthenticationFilter(
    private val jwtProvider: JWTProvider,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val token = extractTokenFromRequest(request)

        if (token != null && jwtProvider.validateAccessToken(token)) {
            val payload = jwtProvider.extractPayloadFromAccessToken(token)

            if (payload != null) {
                // Create authentication token with roles as authorities
                val authorities = payload.roles.map { SimpleGrantedAuthority("ROLE_$it") }
                val authentication =
                    UsernamePasswordAuthenticationToken(
                        payload.sub,
                        null,
                        authorities,
                    )

                // Store user context in security context
                SecurityContextHolder.getContext().authentication = authentication

                // Store user context in request attributes for later access
                request.setAttribute(
                    "userContext",
                    UserContext(
                        userId = payload.sub,
                        email = payload.email,
                        name = payload.name,
                        accountIds = payload.accountIds,
                        roles = payload.roles,
                    ),
                )
            }
        }

        try {
            filterChain.doFilter(request, response)
        } catch (e: IOException) {
            throw e
        } catch (e: ServletException) {
            throw e
        }
    }

    /**
     * Extract JWT token from Authorization header
     * Expected format: Bearer <token>
     */
    private fun extractTokenFromRequest(request: HttpServletRequest): String? {
        val authHeader = request.getHeader("Authorization") ?: return null

        if (!authHeader.startsWith("Bearer ")) {
            return null
        }

        return authHeader.substring(7)
    }
}
