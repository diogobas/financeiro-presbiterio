/**
 * Role-based authorization annotation and utility class for Spring Security
 * Supports RBAC enforcement on controller methods
 */

@file:Suppress("unused")

package org.example.financeiro.reporting.security

import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component

/**
 * Annotation to restrict access to ADMIN role only
 * Usage: @AdminOnly on controller method
 */
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@PreAuthorize("hasRole('ADMIN')")
annotation class AdminOnly

/**
 * Annotation to restrict access to ADMIN or AUDITOR roles
 * Usage: @AuditorAccess on controller method
 */
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@PreAuthorize("hasRole('ADMIN') or hasRole('AUDITOR')")
annotation class AuditorAccess

/**
 * Annotation to restrict access to authenticated users with VIEWER role or higher
 * Usage: @ViewerAccess on controller method
 */
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@PreAuthorize("hasRole('ADMIN') or hasRole('AUDITOR') or hasRole('VIEWER')")
annotation class ViewerAccess

/**
 * Utility component for RBAC operations
 */
@Component
class RBACService {

  companion object {
    /**
     * Role hierarchy for permission checking
     * ADMIN > AUDITOR > VIEWER
     */
    private val ROLE_HIERARCHY = mapOf(
        "ADMIN" to listOf("ADMIN", "AUDITOR", "VIEWER"),
        "AUDITOR" to listOf("AUDITOR", "VIEWER"),
        "VIEWER" to listOf("VIEWER")
    )

    /**
     * Permission matrix by role
     */
    private val ROLE_PERMISSIONS = mapOf(
        "ADMIN" to setOf(
            "accounts:create", "accounts:read", "accounts:update", "accounts:delete",
            "imports:create", "imports:read", "imports:delete",
            "rules:create", "rules:read", "rules:update", "rules:delete",
            "transactions:read", "transactions:classify",
            "overrides:read", "overrides:delete",
            "reports:read"
        ),
        "AUDITOR" to setOf(
            "accounts:read",
            "imports:read",
            "rules:read",
            "transactions:read",
            "overrides:read", "overrides:delete",
            "reports:read"
        ),
        "VIEWER" to setOf(
            "accounts:read",
            "imports:read",
            "rules:read",
            "transactions:read",
            "overrides:read",
            "reports:read"
        )
    )
  }

  /**
   * Get current user's roles from SecurityContext
   */
  fun getCurrentUserRoles(): List<String> {
    val authentication = SecurityContextHolder.getContext().authentication
    return authentication?.authorities?.map { it.authority.removePrefix("ROLE_") } ?: emptyList()
  }

  /**
   * Get current user's ID from SecurityContext
   */
  fun getCurrentUserId(): String? {
    val authentication = SecurityContextHolder.getContext().authentication
    return authentication?.name
  }

  /**
   * Get current user's context from SecurityContext
   */
  fun getCurrentUserContext(): UserContext? {
    val authentication = SecurityContextHolder.getContext().authentication
    val userContext = authentication?.principal as? UserContext
    return userContext
  }

  /**
   * Check if user has specific role
   */
  fun hasRole(roles: List<String>, requiredRole: String): Boolean {
    return roles.contains(requiredRole)
  }

  /**
   * Check if user has any of the required roles
   */
  fun hasAnyRole(roles: List<String>, requiredRoles: List<String>): Boolean {
    return roles.any { it in requiredRoles }
  }

  /**
   * Check if user has role or higher in hierarchy
   */
  fun hasRoleOrHigher(roles: List<String>, minimumRole: String): Boolean {
    for (userRole in roles) {
      val hierarchy = ROLE_HIERARCHY[userRole] ?: continue
      if (minimumRole in hierarchy) {
        return true
      }
    }
    return false
  }

  /**
   * Get all permissions for given roles
   */
  fun getPermissions(roles: List<String>): Set<String> {
    val permissions = mutableSetOf<String>()
    for (role in roles) {
      ROLE_PERMISSIONS[role]?.let { permissions.addAll(it) }
    }
    return permissions
  }

  /**
   * Check if user has specific permission
   */
  fun hasPermission(roles: List<String>, permission: String): Boolean {
    val permissions = getPermissions(roles)
    return permission in permissions
  }

  /**
   * Check if user can access account
   * ADMIN can access all, others need account in their accountIds
   */
  fun canAccessAccount(userContext: UserContext?, accountId: String): Boolean {
    if (userContext == null) return false
    if (userContext.roles.contains("ADMIN")) return true
    return accountId in userContext.accountIds
  }

  /**
   * Check if user can access only their own resources
   * ADMIN can access all, others can only access themselves
   */
  fun canAccessSelfOnly(userContext: UserContext?, targetUserId: String): Boolean {
    if (userContext == null) return false
    if (userContext.roles.contains("ADMIN")) return true
    return userContext.userId == targetUserId
  }
}
