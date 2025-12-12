package org.example.financeiro.reporting

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.TestPropertySource

@SpringBootTest
@TestPropertySource(properties = [
    "spring.datasource.url=jdbc:h2:mem:testdb",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.hbm2ddl.auto=create-drop",
    "jwt.secret=test-secret-key-for-testing-only-1234567890",
    "jwt.refresh-secret=test-refresh-secret-key-for-testing-only-1234567890"
])
class ReportingApplicationTests {

	@Test
	fun contextLoads() {
	}

}
