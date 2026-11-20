# Verified official Temurin JRE tag includes linux/arm64/v8 (Docker Hub manifest checked 2026-10-24).
FROM eclipse-temurin:17.0.20.1_1-jre-jammy

# Identity runtime image: pre-built artifacts only — the CI build compiles the jar;
# this image neither downloads nor compiles anything.
COPY platform/identity/build/libs/identity.jar /app/app.jar

EXPOSE 8081 9092

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:${SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT:-9092}/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
