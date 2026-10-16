plugins {
    id("supportfolio.spring-service-conventions")
}

repositories {
    mavenCentral()
}

tasks.named("bootJar") {
    enabled = false
}
