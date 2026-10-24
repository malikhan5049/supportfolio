# Verified official Temurin JRE tag includes linux/arm64/v8 (Docker Hub manifest checked 2026-10-24).
FROM eclipse-temurin:17.0.20.1_1-jre-jammy

# TinyURL runtime image: pre-built artifacts only — the CI build compiles the jar and the
# microfrontend; this image neither downloads nor compiles anything.
COPY projects/tinyurl/service/build/libs/tinyurl-service.jar /app/app.jar
COPY dist/projects/tinyurl/microfrontend/ /app/static/

ENV SPRING_WEB_RESOURCES_STATIC_LOCATIONS=file:/app/static/

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
