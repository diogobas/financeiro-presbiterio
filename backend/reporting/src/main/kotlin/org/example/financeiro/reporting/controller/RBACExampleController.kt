/**
 * Example controller demonstrating RBAC in practice
 * Shows how to use annotations and RBACService for authorization
 */

package org.example.financeiro.reporting.controller

import org.example.financeiro.reporting.security.AdminOnly
import org.example.financeiro.reporting.security.AuditorAccess
import org.example.financeiro.reporting.security.RBACService
import org.example.financeiro.reporting.security.ViewerAccess
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1")
class RBACExampleController(
    private val rbacService: RBACService
) {

  /**
   * Admin-only endpoint
   * Only ADMIN users can access
   */
  @PostMapping("/admin/users")
  @AdminOnly
  fun createUser(authentication: Authentication): ResponseEntity<Map<String, String>> {
    val userContext = rbacService.getCurrentUserContext()
    return ResponseEntity.ok(mapOf(
        "message" to "User created successfully",
        "createdBy" to (userContext?.userId ?: "unknown")
    ))
  }

  /**
   * Auditor+ endpoint
   * ADMIN and AUDITOR users can access
   */
  @PostMapping("/audit/overrides")
  @AuditorAccess
  fun approveOverride(authentication: Authentication): ResponseEntity<Map<String, String>> {
    val userContext = rbacService.getCurrentUserContext()
    return ResponseEntity.ok(mapOf(
        "message" to "Override approved",
        "approvedBy" to (userContext?.email ?: "unknown")
    ))
  }

  /**
   * Viewer+ endpoint
   * All authenticated users (ADMIN, AUDITOR, VIEWER) can access
   */
  @GetMapping("/reports/{accountId}")
  @ViewerAccess
  fun getReport(
      @PathVariable accountId: String,
      authentication: Authentication
  ): ResponseEntity<Map<String, String>> {
    val userContext = rbacService.getCurrentUserContext()
    
    // Check if user can access this specific account
    if (!rbacService.canAccessAccount(userContext, accountId)) {
      return ResponseEntity.status(403).body(mapOf(
          "error" to "Forbidden",
          "message" to "You do not have access to this account"
      ))
    }

    return ResponseEntity.ok(mapOf(
        "accountId" to accountId,
        "accessedBy" to (userContext?.email ?: "unknown"),
        "userRoles" to userContext?.roles.toString()
    ))
  }

  /**
   * Permission-based authorization using RBACService
   */
  @GetMapping("/transactions/{transactionId}")
  @ViewerAccess
  fun getTransaction(
      @PathVariable transactionId: String,
      authentication: Authentication
  ): ResponseEntity<Map<String, String>> {
    val userContext = rbacService.getCurrentUserContext()
    
    if (userContext == null) {
      return ResponseEntity.status(401).body(mapOf(
          "error" to "Unauthorized",
          "message" to "Authentication required"
      ))
    }

    // Manual permission check
    if (!rbacService.hasPermission(userContext.roles, "transactions:read")) {
      return ResponseEntity.status(403).body(mapOf(
          "error" to "Forbidden",
          "message" to "You do not have permission to read transactions"
      ))
    }

    val permissions = rbacService.getPermissions(userContext.roles)
    val canClassify = rbacService.hasPermission(userContext.roles, "transactions:classify")

    return ResponseEntity.ok(mapOf(
        "transactionId" to transactionId,
        "canRead" to "true",
        "canClassify" to canClassify.toString(),
        "allPermissions" to permissions.toString()
    ))
  }

  /**
   * Self-only access endpoint
   * Users can only access their own profile
   */
  @GetMapping("/profile/{userId}")
  fun getProfile(
      @PathVariable userId: String,
      authentication: Authentication
  ): ResponseEntity<Map<String, String>> {
    val userContext = rbacService.getCurrentUserContext()
    
    // Check self-access or admin
    if (!rbacService.canAccessSelfOnly(userContext, userId)) {
      return ResponseEntity.status(403).body(mapOf(
          "error" to "Forbidden",
          "message" to "You can only access your own profile"
      ))
    }

    return ResponseEntity.ok(mapOf(
        "userId" to userId,
        "email" to (userContext?.email ?: "unknown"),
        "roles" to userContext?.roles.toString()
    ))
  }

  /**
   * Admin check using service
   */
  @GetMapping("/admin/system-info")
  fun getSystemInfo(authentication: Authentication): ResponseEntity<Any> {
    val userRoles = rbacService.getCurrentUserRoles()
    
    if (!rbacService.hasRole(userRoles, "ADMIN")) {
      return ResponseEntity.status(403).body(mapOf(
          "error" to "Forbidden",
          "message" to "Admin role required"
      ))
    }

    return ResponseEntity.ok(mapOf(
        "status" to "healthy",
        "version" to "1.0.0"
    ))
  }
}
