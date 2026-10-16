import org.gradle.api.initialization.resolve.RepositoriesMode

rootProject.name = "supportfolio"

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
    }
}

includeBuild("build-logic")
