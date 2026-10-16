plugins {
    `kotlin-dsl`
}

repositories {
    gradlePluginPortal()
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-gradle-plugin:3.4.1")
    implementation("io.spring.gradle:dependency-management-plugin:1.1.6")
    
    testImplementation(gradleTestKit())
    testImplementation("junit:junit:4.13.2")
    testImplementation(kotlin("test"))
}



