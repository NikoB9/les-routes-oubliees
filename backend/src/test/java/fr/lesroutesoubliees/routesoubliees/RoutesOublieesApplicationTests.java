package fr.lesroutesoubliees.routesoubliees;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
class RoutesOublieesApplicationTests {

	@Autowired
	private ApplicationContext context;

	@Test
	void contextLoads() {
	}

	/**
	 * Garde-fou d'autoconfiguration.
	 *
	 * <p>Spring Boot ne cree son executeur de taches applicatif que si le contexte ne declare
	 * aucun bean de type {@link java.util.concurrent.Executor} : la condition
	 * {@code OnExecutorCondition} combine {@code @ConditionalOnMissingBean(Executor.class)} et
	 * {@code spring.task.execution.mode=force}.
	 *
	 * <p>Un executeur declare comme bean pour un besoin local le supprimerait donc
	 * silencieusement, et le traitement asynchrone de Spring MVC — dont les flux SSE Radar —
	 * retomberait sur un {@code SimpleAsyncTaskExecutor} creant un thread par requete, sans
	 * limite. Un executeur specialise doit rester interne au composant qui l'utilise.
	 */
	@Test
	void keepsTheApplicationTaskExecutorProvidedBySpringBoot() {
		assertThat(context.containsBean("applicationTaskExecutor"))
			.as("aucun bean Executor ne doit desactiver l'executeur de taches de Spring Boot")
			.isTrue();
	}

}
