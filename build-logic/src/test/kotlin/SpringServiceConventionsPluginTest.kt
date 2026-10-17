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
        val result = GradleRunner.create()
            .withProjectDir(fixtureDir)
            .withArguments("build")
            .withPluginClasspath()
            .build()
        assertEquals(TaskOutcome.SUCCESS, result.task(":build")?.outcome)
    }
}
