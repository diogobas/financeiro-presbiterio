# Reporting Service (Java 21 + Spring Boot)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Copy sources (wrapper/gradle dir brought along if present)
COPY . /workspace/

# Attempt build (Maven/Gradle) if configuration exists
RUN if [ -f mvnw ] || [ -f pom.xml ]; then ./mvnw -q -DskipTests package || true; fi && \
    if [ -f gradlew ] || [ -f build.gradle ]; then ./gradlew -q clean build -x test || true; fi

FROM eclipse-temurin:21-jre AS run
WORKDIR /app
COPY --from=build /workspace/target/*.jar /app/ 2>/dev/null || true
COPY --from=build /workspace/build/libs/*.jar /app/ 2>/dev/null || true
EXPOSE 8081
ENTRYPOINT ["sh","-c","JAR=$(ls -1 /app/*.jar 2>/dev/null | head -n1); if [ -n \"$JAR\" ]; then java -jar \"$JAR\"; else echo 'No jar found, sleeping'; sleep 3600; fi"]
