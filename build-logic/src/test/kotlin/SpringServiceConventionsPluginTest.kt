import org.gradle.testkit.runner.GradleRunner
import org.gradle.testkit.runner.TaskOutcome
import org.junit.Test
import java.io.File
import kotlin.test.assertEquals

class SpringServiceConventionsPluginTest {
    @Test
    fun `fixture project applying the plugin builds successfully`() {
        val fixtureDir = File("src/test/resources/fixture-project")
        val result = GradleRunner.create()
            .withProjectDir(fixtureDir)
            .withArguments("build")
            .withPluginClasspath()
            .build()
        assertEquals(TaskOutcome.SUCCESS, result.task(":build")?.outcome)
    }
}

