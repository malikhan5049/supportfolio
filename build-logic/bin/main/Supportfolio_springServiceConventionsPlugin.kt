/**
 * Precompiled [supportfolio.spring-service-conventions.gradle.kts][Supportfolio_spring_service_conventions_gradle] script plugin.
 *
 * @see Supportfolio_spring_service_conventions_gradle
 */
public
class Supportfolio_springServiceConventionsPlugin : org.gradle.api.Plugin<org.gradle.api.Project> {
    override fun apply(target: org.gradle.api.Project) {
        try {
            Class
                .forName("Supportfolio_spring_service_conventions_gradle")
                .getDeclaredConstructor(org.gradle.api.Project::class.java, org.gradle.api.Project::class.java)
                .newInstance(target, target)
        } catch (e: java.lang.reflect.InvocationTargetException) {
            throw e.targetException
        }
    }
}
