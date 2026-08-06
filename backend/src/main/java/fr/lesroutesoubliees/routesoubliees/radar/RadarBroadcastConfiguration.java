package fr.lesroutesoubliees.routesoubliees.radar;

import java.util.concurrent.Executor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Executeur des diffusions SSE.
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
 * <p>Residu assume : un client bloque retarde les instantanes des autres jusqu'a la fin de
 * sa connexion. Le balayage, le heartbeat et les threads de requete ne peuvent plus l'etre.
 */
@Configuration(proxyBeanMethods = false)
class RadarBroadcastConfiguration {

	private static final Logger LOGGER = LoggerFactory.getLogger(RadarBroadcastConfiguration.class);

	/** Au-dela, les instantanes en attente sont obsoletes : le plus ancien est abandonne. */
	private static final int QUEUE_CAPACITY = 64;

	@Bean(destroyMethod = "shutdown")
	Executor radarDeliveryExecutor() {
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
