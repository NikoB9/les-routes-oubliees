package fr.lesroutesoubliees.routesoubliees.radar;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Fabrique de l'executeur des diffusions SSE.
 *
 * <p>Une ecriture SSE est bloquante : un client qui ne lit plus sans fermer sa connexion
 * remplit le tampon reseau et immobilise le thread appelant. Tant que la diffusion partait
 * du thread du planificateur, un seul client dans cet etat suspendait le balayage des
 * presences — donc la diffusion des disparitions, exactement ce que le filet de securite
 * doit garantir.
 *
 * <p>Un seul thread, volontairement : l'ordre des instantanes doit etre conserve, sans quoi
 * un etat ancien pourrait ecraser un etat recent chez les abonnes.
 *
 * <p><strong>Volontairement pas un bean.</strong> Spring Boot ne cree son executeur de
 * taches applicatif que si le contexte ne declare aucun bean de type
 * {@link java.util.concurrent.Executor}. Exposer celui-ci comme bean supprimerait donc
 * {@code applicationTaskExecutor}, et le traitement asynchrone de Spring MVC — dont ces
 * memes flux SSE — retomberait sur un executeur creant un thread par requete, sans limite.
 * {@link RadarEventBroadcaster} en est donc le seul proprietaire.
 */
final class RadarDeliveryExecutor {

	private static final Logger LOGGER = LoggerFactory.getLogger(RadarDeliveryExecutor.class);

	/** Au-dela, les instantanes en attente sont obsoletes : le plus ancien est abandonne. */
	private static final int QUEUE_CAPACITY = 64;

	private RadarDeliveryExecutor() {
	}

	static ThreadPoolTaskExecutor create() {
		var executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(1);
		executor.setMaxPoolSize(1);
		executor.setQueueCapacity(QUEUE_CAPACITY);
		executor.setThreadNamePrefix("radar-sse-");
		// Un arret ne doit pas attendre une ecriture bloquee sur un client muet.
		executor.setWaitForTasksToCompleteOnShutdown(false);
		executor.setRejectedExecutionHandler((task, poolExecutor) -> {
			if (poolExecutor.isShutdown()) {
				return;
			}
			// Chaque instantane est un etat complet : perdre le plus ancien est sans effet,
			// contrairement a une file qui grossirait sans limite.
			var dropped = poolExecutor.getQueue().poll();
			if (dropped != null) {
				LOGGER.warn("File de diffusion Radar saturee : un instantane en attente a ete abandonne.");
			}
			poolExecutor.execute(task);
		});
		executor.initialize();
		return executor;
	}
}
