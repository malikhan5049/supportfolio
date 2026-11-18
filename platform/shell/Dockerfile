# Verified official Temurin JRE tag includes linux/arm64/v8 (Docker Hub manifest checked 2026-10-24).
FROM eclipse-temurin:17.0.20.1_1-jre-jammy

# Shell runtime image: pre-built artifacts only — the CI build compiles the jar and the
# Angular host/microfrontends; this image neither downloads nor compiles anything.
COPY platform/shell/build/libs/shell.jar /app/app.jar
COPY dist/platform/shell/host/ /app/static/
COPY dist/projects/tinyurl/microfrontend/ /app/static/apps/tinyurl/

ENV SPRING_WEB_RESOURCES_STATIC_LOCATIONS=classpath:/static/,file:/app/static/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
