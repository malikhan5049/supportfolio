plugins {
    id("supportfolio.spring-service-conventions")
}

dependencies {
    implementation(project(":platform:shared-spring-starter"))
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    // Boot 4 modularized: the Flyway autoconfiguration lives in this module, not in flyway-core.
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    // TinyURL is a Spring Cloud Gateway Server MVC consumer (same as the shell): the SPA served
    // from this service sits behind the same-origin proxy. This dependency is coordinated with the
    // shell's 2025.1.3 BOM usage. Known caveat (Plan 3/4): the BOM line certifies Boot 4.0.x
    // while the workspace pins 4.1.1 — the shell boots in this combination, so TinyURL reuses it.
    implementation("org.springframework.cloud:spring-cloud-starter-gateway-server-webmvc")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    // Boot 4.1's BOM does not manage Testcontainers here; import TC's BOM (2.0.5, the
    // current stable release as of 2026-10-21) and use the 2.x coordinates at their
    // managed versions.
    testImplementation(platform("org.testcontainers:testcontainers-bom:2.0.5"))
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2025.1.3")
    }
}

tasks.bootJar {
    archiveFileName = "tinyurl-service.jar"
}
