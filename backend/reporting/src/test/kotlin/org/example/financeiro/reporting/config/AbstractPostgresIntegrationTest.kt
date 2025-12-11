/**
 * Abstract base test class for integration tests with PostgreSQL testcontainer
 */

package org.example.financeiro.reporting.config

import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

@SpringBootTest
@Testcontainers
abstract class AbstractPostgresIntegrationTest {

  companion object {
    @Container
    val postgreSQLContainer = PostgreSQLContainer("postgres:16")
        .withDatabaseName("reporting_test")
        .withUsername("test_user")
        .withPassword("test_password")

    @DynamicPropertySource
    @JvmStatic
    fun configureProperties(registry: DynamicPropertyRegistry) {
      registry.add("spring.datasource.url", postgreSQLContainer::getJdbcUrl)
      registry.add("spring.datasource.username", postgreSQLContainer::getUsername)
      registry.add("spring.datasource.password", postgreSQLContainer::getPassword)
    }
  }
}
