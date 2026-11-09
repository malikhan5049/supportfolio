plugins {
    `kotlin-dsl`
}

repositories {
    gradlePluginPortal()
    mavenCentral()
}

val catalogFile = file("../gradle/libs.versions.toml")
val spotlessVersion = Regex("^spotless\\s*=\\s*\"([^\"]+)\"", RegexOption.MULTILINE)
    .find(catalogFile.readText())
    ?.groupValues
    ?.get(1) ?: error("build-logic requires a 'spotless' version in ${catalogFile.path}")

dependencies {
    implementation("org.springframework.boot:spring-boot-gradle-plugin:4.1.2")
    implementation("io.spring.gradle:dependency-management-plugin:1.1.7")
    implementation("com.diffplug.spotless:com.diffplug.spotless.gradle.plugin:$spotlessVersion")
    compileOnly("com.diffplug.spotless:spotless-plugin-gradle:$spotlessVersion")

    testImplementation(gradleTestKit())
    testImplementation("junit:junit:4.13.2")
    testImplementation(kotlin("test"))
}



