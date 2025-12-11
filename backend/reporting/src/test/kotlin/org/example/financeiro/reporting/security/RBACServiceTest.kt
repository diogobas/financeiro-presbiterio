/**
 * Unit tests for RBACService
 */

package org.example.financeiro.reporting.security

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@DisplayName("RBAC Service Tests")
class RBACServiceTest {

  private lateinit var rbacService: RBACService

  @BeforeEach
  fun setup() {
    rbacService = RBACService()
  }

  @Test
  @DisplayName("hasRole should return true if user has required role")
  fun testHasRole() {
    val roles = listOf("ADMIN", "VIEWER")
    assertTrue(rbacService.hasRole(roles, "ADMIN"))
    assertTrue(rbacService.hasRole(roles, "VIEWER"))
    assertFalse(rbacService.hasRole(roles, "AUDITOR"))
  }

  @Test
  @DisplayName("hasAnyRole should return true if user has any of the required roles")
  fun testHasAnyRole() {
    val roles = listOf("VIEWER")
    assertTrue(rbacService.hasAnyRole(roles, listOf("ADMIN", "VIEWER")))
    assertFalse(rbacService.hasAnyRole(roles, listOf("ADMIN", "AUDITOR")))
  }

  @Test
  @DisplayName("hasRoleOrHigher should enforce role hierarchy")
  fun testHasRoleOrHigher() {
    // ADMIN should have access to AUDITOR operations
    assertTrue(rbacService.hasRoleOrHigher(listOf("ADMIN"), "AUDITOR"))

    // AUDITOR should have access to VIEWER operations
    assertTrue(rbacService.hasRoleOrHigher(listOf("AUDITOR"), "VIEWER"))

    // VIEWER should not have access to AUDITOR operations
    assertFalse(rbacService.hasRoleOrHigher(listOf("VIEWER"), "AUDITOR"))
  }

  @Test
  @DisplayName("getPermissions should return all permissions for ADMIN")
  fun testGetPermissionsAdmin() {
    val permissions = rbacService.getPermissions(listOf("ADMIN"))

    assertTrue(permissions.contains("accounts:create"))
    assertTrue(permissions.contains("accounts:delete"))
    assertTrue(permissions.contains("rules:create"))
    assertTrue(permissions.contains("transactions:classify"))
  }

  @Test
  @DisplayName("getPermissions should return read+override for AUDITOR")
  fun testGetPermissionsAuditor() {
    val permissions = rbacService.getPermissions(listOf("AUDITOR"))

    assertTrue(permissions.contains("accounts:read"))
    assertTrue(permissions.contains("transactions:read"))
    assertFalse(permissions.contains("accounts:create"))
  }

  @Test
  @DisplayName("getPermissions should return read-only for VIEWER")
  fun testGetPermissionsViewer() {
    val permissions = rbacService.getPermissions(listOf("VIEWER"))

    assertTrue(permissions.contains("accounts:read"))
    assertTrue(permissions.contains("reports:read"))
    assertFalse(permissions.contains("accounts:create"))
    assertFalse(permissions.contains("transactions:override"))
  }

  @Test
  @DisplayName("hasPermission should check specific permissions")
  fun testHasPermission() {
    val adminUser = createAdminUser()
    val viewerUser = createViewerUser()

    assertTrue(rbacService.hasPermission(adminUser.roles, "accounts:create"))
    assertFalse(rbacService.hasPermission(viewerUser.roles, "accounts:create"))
    assertTrue(rbacService.hasPermission(viewerUser.roles, "accounts:read"))
  }

  @Test
  @DisplayName("canAccessAccount should allow ADMIN to access any account")
  fun testCanAccessAccountAdmin() {
    val adminUser = createAdminUser()
    assertTrue(rbacService.canAccessAccount(adminUser, "any-account-id"))
  }

  @Test
  @DisplayName("canAccessAccount should restrict non-ADMIN to their accounts")
  fun testCanAccessAccountNonAdmin() {
    val viewerUser = createViewerUser(accountIds = listOf("account-1"))
    assertTrue(rbacService.canAccessAccount(viewerUser, "account-1"))
    assertFalse(rbacService.canAccessAccount(viewerUser, "account-999"))
  }

  @Test
  @DisplayName("canAccessSelfOnly should allow ADMIN to access any user")
  fun testCanAccessSelfOnlyAdmin() {
    val adminUser = createAdminUser()
    assertTrue(rbacService.canAccessSelfOnly(adminUser, "any-user-id"))
  }

  @Test
  @DisplayName("canAccessSelfOnly should restrict non-ADMIN to themselves")
  fun testCanAccessSelfOnlyNonAdmin() {
    val viewerUser = createViewerUser(userId = "user-123")
    assertTrue(rbacService.canAccessSelfOnly(viewerUser, "user-123"))
    assertFalse(rbacService.canAccessSelfOnly(viewerUser, "user-456"))
  }
}
