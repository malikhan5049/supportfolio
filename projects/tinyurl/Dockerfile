FROM eclipse-temurin:17-jre-alpine

# TinyURL runtime image: pre-built artifacts only — the CI build compiles the jar and the
# microfrontend; this image neither downloads nor compiles anything.
COPY projects/tinyurl/service/build/libs/tinyurl-service.jar /app/app.jar
COPY dist/projects/tinyurl/microfrontend/ /app/static/

ENV SPRING_WEB_RESOURCES_STATIC_LOCATIONS=file:/app/static/

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
