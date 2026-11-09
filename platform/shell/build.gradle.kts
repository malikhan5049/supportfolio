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

    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.squareup.okhttp3:mockwebserver:5.5.1")
    // mockwebserver:5.x routes through mockwebserver3, which needs OkHttp 5 internals; the
    // spring-cloud BOM still pins the okhttp family to 4.12.0 (since the Boot 3.4 BOM dropped
    // that management). Declare okhttp explicitly so mockwebserver's transitive dep isn't
    // downgraded, breaking MockWebServer startup with NoClassDefFoundError _UtilJvmKt.
    testImplementation("com.squareup.okhttp3:okhttp:5.5.1")
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
}
