plugins {
    id("supportfolio.spring-service-conventions")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    compileOnly("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    // The chain scopes itself against actuator endpoint requests, which references the servlet API
    // at compile time; MVC/web consumers supply it at runtime.
    compileOnly("jakarta.servlet:jakarta.servlet-api")
    testImplementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    testImplementation("org.springframework.boot:spring-boot-starter-web")
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
}

tasks.test {
    useJUnitPlatform()
}

tasks.bootJar {
    enabled = false
}

tasks.jar {
    enabled = true
}
