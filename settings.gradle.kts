import org.gradle.api.initialization.resolve.RepositoriesMode

rootProject.name = "supportfolio"

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
    }
    versionCatalogs {
        create("libs") {
            from(files("gradle/catalogs/libs.versions.toml"))
        }
    }
}

includeBuild("build-logic")
