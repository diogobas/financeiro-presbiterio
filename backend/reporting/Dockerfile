# Build stage
FROM maven:3.9.5-eclipse-temurin-21 AS builder
WORKDIR /workspace/app

# Copy Maven files
COPY pom.xml .
COPY src src

# Build the application
RUN mvn clean package -DskipTests

# Production stage
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create non-root user
RUN groupadd -r app && useradd -r -g app app
USER app

# Copy the built JAR file
COPY --from=builder /workspace/app/target/*.jar app.jar

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/actuator/health || exit 1

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
