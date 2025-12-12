package org.example.financeiro.reporting.security

import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

/**
 * Spring Security configuration for JWT-based authentication
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
class SecurityConfig(
    private val jwtProvider: JWTProvider,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http.csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    // Public endpoints
                    .requestMatchers("/health", "/health/db", "/health/live", "/health/ready")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/auth/login", "/auth/register")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/auth/refresh")
                    .permitAll()
                    // GraphQL endpoint requires authentication
                    .requestMatchers("/graphql")
                    .authenticated()
                    // All other endpoints require authentication
                    .anyRequest()
                    .authenticated()
            }
            .exceptionHandling { handler ->
                handler
                    .authenticationEntryPoint { _, response, authException ->
                        response.sendError(
                            HttpServletResponse.SC_UNAUTHORIZED,
                            "Unauthorized: ${authException.message}",
                        )
                    }
                    .accessDeniedHandler { _, response, accessDeniedException ->
                        response.sendError(
                            HttpServletResponse.SC_FORBIDDEN,
                            "Access denied: ${accessDeniedException.message}",
                        )
                    }
            }
            // Add JWT filter before Spring's UsernamePasswordAuthenticationFilter
            .addFilterBefore(JWTAuthenticationFilter(jwtProvider), UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }
}
