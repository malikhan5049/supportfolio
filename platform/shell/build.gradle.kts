plugins {
    id("supportfolio.spring-service-conventions")
}

dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2025.1.4")
    }
}

dependencies {
    implementation(project(":platform:shared-spring-starter"))
    implementation("org.springframework.cloud:spring-cloud-starter-gateway-server-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    // Prometheus-format metrics for the management endpoint; version-managed by the Boot BOM.
    implementation("io.micrometer:micrometer-registry-prometheus")
    // DevTools is BOM-managed by Boot 4.1.1; developmentOnly keeps it out of prod images.
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
}

tasks.bootJar {
    archiveFileName = "shell.jar"
}

tasks.jar {
    enabled = false
}
