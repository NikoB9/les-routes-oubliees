package fr.lesroutesoubliees.routesoubliees.radar;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Diffusion des evenements Radar aux flux SSE ouverts.
 *
 * <p>Isolee du service afin que la diffusion soit observable en test : la disparition d'un
 * participant, qu'elle vienne d'un depart explicite ou de l'expiration serveur, doit
 * atteindre les autres participants sans nouvelle publication de position.
 *
 * <p>Les diffusions sont deleguees a un executeur dedie a un seul thread : une ecriture
 * bloquee sur un client muet ne doit jamais immobiliser le balayage des presences ni un
 * thread de requete. Voir {@link RadarBroadcastConfiguration}.
 */
@Component
class RadarEventBroadcaster {

	private static final Logger LOGGER = LoggerFactory.getLogger(RadarEventBroadcaster.class);

	private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
	private final Executor deliveries;

	RadarEventBroadcaster(Executor radarDeliveryExecutor) {
		this.deliveries = radarDeliveryExecutor;
	}

	SseEmitter register(long timeoutMs) {
		return attach(new SseEmitter(timeoutMs));
	}

	/** Suit un flux existant : point d'entree unique de l'enregistrement et des tests. */
	SseEmitter attach(SseEmitter emitter) {
		emitters.add(emitter);
		emitter.onCompletion(() -> emitters.remove(emitter));
		emitter.onTimeout(() -> emitters.remove(emitter));
		emitter.onError((error) -> emitters.remove(emitter));
		return emitter;
	}

	/**
	 * Envoie un evenement a un flux precis, en le fermant si l'ecriture echoue.
	 *
	 * <p>Appele directement, sur le thread de la requete, pour l'instantane initial d'un
	 * nouvel abonne : celui-ci doit partir avant que l'emetteur soit rendu au conteneur.
	 */
	void send(SseEmitter emitter, String name, Object data) {
		try {
			emitter.send(SseEmitter.event().name(name).data(data));
		}
		catch (IOException | IllegalStateException exception) {
			LOGGER.debug("Flux Radar retire apres un echec d'ecriture.", exception);
			emitters.remove(emitter);
			emitter.complete();
		}
	}

	/**
	 * Envoie un evenement a tous les flux ouverts.
	 *
	 * <p>Une seule tache est soumise par diffusion, de sorte que l'ordre des evenements est
	 * conserve. Le retour est immediat : l'appelant n'attend aucune ecriture reseau.
	 */
	void broadcast(String name, Object data) {
		deliveries.execute(() -> {
			for (var emitter : emitters) {
				send(emitter, name, data);
			}
		});
	}

	/** Nombre de flux actuellement ouverts, pour les tests et le diagnostic. */
	int openStreams() {
		return emitters.size();
	}
}
