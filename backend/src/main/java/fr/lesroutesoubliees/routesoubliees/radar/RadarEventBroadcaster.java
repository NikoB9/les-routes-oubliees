package fr.lesroutesoubliees.routesoubliees.radar;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Diffusion des evenements Radar aux flux SSE ouverts.
 *
 * <p>Isolee du service afin que la diffusion soit observable en test : la disparition d'un
 * participant, qu'elle vienne d'un depart explicite ou de l'expiration serveur, doit
 * atteindre les autres participants sans nouvelle publication de position.
 */
@Component
class RadarEventBroadcaster {

	private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

	SseEmitter register(long timeoutMs) {
		var emitter = new SseEmitter(timeoutMs);
		emitters.add(emitter);
		emitter.onCompletion(() -> emitters.remove(emitter));
		emitter.onTimeout(() -> emitters.remove(emitter));
		emitter.onError((error) -> emitters.remove(emitter));
		return emitter;
	}

	/** Envoie un evenement a un flux precis, en le fermant si l'ecriture echoue. */
	void send(SseEmitter emitter, String name, Object data) {
		try {
			emitter.send(SseEmitter.event().name(name).data(data));
		}
		catch (IOException | IllegalStateException exception) {
			emitters.remove(emitter);
			emitter.complete();
		}
	}

	/** Envoie un evenement a tous les flux ouverts. */
	void broadcast(String name, Object data) {
		for (var emitter : emitters) {
			send(emitter, name, data);
		}
	}
}
