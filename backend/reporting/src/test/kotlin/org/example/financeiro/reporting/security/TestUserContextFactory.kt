/**
 * Test utilities for RBAC and security testing
 */

package org.example.financeiro.reporting.security

/**
 * Create a test user context
 */
fun createTestUser(
    userId: String = "test-user-123",
    email: String = "test@example.com",
    name: String = "Test User",
    accountIds: List<String> = listOf("account-1", "account-2"),
    roles: List<String> = listOf("VIEWER")
): UserContext {
  return UserContext(
      userId = userId,
      email = email,
      name = name,
      accountIds = accountIds,
      roles = roles
  )
}

/**
 * Create an admin user for testing
 */
fun createAdminUser(
    userId: String = "admin-123",
    email: String = "admin@example.com"
): UserContext {
  return createTestUser(
      userId = userId,
      email = email,
      roles = listOf("ADMIN")
  )
}

/**
 * Create an auditor user for testing
 */
fun createAuditorUser(
    userId: String = "auditor-123",
    email: String = "auditor@example.com"
): UserContext {
  return createTestUser(
      userId = userId,
      email = email,
      roles = listOf("AUDITOR")
  )
}

/**
 * Create a viewer user for testing
 */
fun createViewerUser(
    userId: String = "viewer-123",
    email: String = "viewer@example.com",
    accountIds: List<String> = listOf("account-1", "account-2")
): UserContext {
  return createTestUser(
      userId = userId,
      email = email,
      accountIds = accountIds,
      roles = listOf("VIEWER")
  )
}
