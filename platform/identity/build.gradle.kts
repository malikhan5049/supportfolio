plugins {
    id("supportfolio.spring-service-conventions")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.security:spring-security-oauth2-jose")
    // Prometheus-format metrics for the management endpoint; version-managed by the Boot BOM.
    implementation("io.micrometer:micrometer-registry-prometheus")
    // DevTools is BOM-managed by Boot 4.1.1; developmentOnly keeps it out of prod images.
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.squareup.okhttp3:mockwebserver:5.5.0")
}

tasks.bootJar {
    archiveFileName = "identity.jar"
}

tasks.jar {
    enabled = false
}
