import org.gradle.testkit.runner.GradleRunner
import org.gradle.testkit.runner.TaskOutcome
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import kotlin.test.assertEquals

class SpringServiceConventionsPluginTest {

    @get:Rule
    val tempDir = TemporaryFolder()

    @Test
    fun `fixture project applying the plugin builds successfully`() {
        val fixtureDir = tempDir.root.resolve("fixture-project")
        File("src/test/resources/fixture-project").copyRecursively(fixtureDir)
        fixtureDir.resolve("src/main/java/com/supportfolio/fixture/Misformatted.java").delete()
        val result = GradleRunner.create()
            .withProjectDir(fixtureDir)
            .withArguments("build")
            .withPluginClasspath()
            .build()
        assertEquals(TaskOutcome.SUCCESS, result.task(":build")?.outcome)
    }

    @Test
    fun `fixture project with misformatted Java fails spotlessCheck`() {
        val fixtureDir = tempDir.root.resolve("fixture-project-misformatted")
        File("src/test/resources/fixture-project").copyRecursively(fixtureDir)
        val result = GradleRunner.create()
            .withProjectDir(fixtureDir)
            .withArguments("spotlessCheck")
            .withPluginClasspath()
            .buildAndFail()
        assertEquals(TaskOutcome.FAILED, result.task(":spotlessJavaCheck")?.outcome)
    }
}
