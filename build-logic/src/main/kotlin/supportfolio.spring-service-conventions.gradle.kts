import org.gradle.api.GradleException
import org.gradle.jvm.toolchain.JavaLanguageVersion

plugins {
    java
    id("com.diffplug.spotless")
}

apply(plugin = "org.springframework.boot")
apply(plugin = "io.spring.dependency-management")

val catalogFile = rootProject.file("gradle/libs.versions.toml")
val javaCatalogVersion = if (catalogFile.exists()) {
    Regex("^java\\s*=\\s*\"([^\"]+)\"", RegexOption.MULTILINE)
        .find(catalogFile.readText())
        ?.groupValues
        ?.get(1)
} else {
    null
} ?: throw GradleException(
    "supportfolio.spring-service-conventions requires a 'java' version in ${catalogFile.path}"
)

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(javaCatalogVersion.toInt())
    }
}

spotless {
    lineEndings = com.diffplug.spotless.LineEnding.UNIX
    java {
        googleJavaFormat()
        target("src/*/java/**/*.java")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
