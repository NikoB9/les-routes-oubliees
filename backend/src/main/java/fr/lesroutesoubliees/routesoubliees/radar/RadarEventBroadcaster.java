package fr.lesroutesoubliees.routesoubliees.radar;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Diffusion des evenements Radar aux flux SSE ouverts.
 *
 * <p>Isolee du service afin que la diffusion soit observable en test : la disparition d'un
 * participant, qu'elle vienne d'un depart explicite ou de l'expiration serveur, doit
 * atteindre les autres participants sans nouvelle publication de position.
 *
 * <p>Aucune ecriture n'a lieu ici. Chaque flux possede sa file et son ecrivain — voir
 * {@link RadarStream} — et la diffusion se limite a un depot non bloquant. Un client bloque
 * ne retarde donc plus les autres, et ni le balayage des presences ni un thread de requete ne
 * peuvent etre immobilises par une ecriture reseau.
 *
 * <p>Volontairement aucun {@link java.util.concurrent.Executor} dans ce paquet : Spring Boot
 * ne cree son executeur de taches applicatif que si le contexte n'en declare aucun, et le
 * supprimer ferait retomber le traitement asynchrone de Spring MVC — dont ces memes flux SSE —
 * sur un executeur creant un thread par requete, sans limite.
 */
@Component
class RadarEventBroadcaster implements DisposableBean {

	private final Map<SseEmitter, RadarStream> streams = new ConcurrentHashMap<>();
	private final AtomicLong streamCounter = new AtomicLong();

	SseEmitter register(long timeoutMs) {
		return attach(new SseEmitter(timeoutMs));
	}

	/** Suit un flux existant : point d'entree unique de l'enregistrement et des tests. */
	SseEmitter attach(SseEmitter emitter) {
		var stream = new RadarStream(emitter, (closed) -> streams.remove(emitter, closed));
		streams.put(emitter, stream);
		emitter.onCompletion(stream::close);
		emitter.onTimeout(stream::close);
		emitter.onError((error) -> stream.close());
		stream.start("radar-sse-" + streamCounter.incrementAndGet());
		return emitter;
	}

	/**
	 * Depose un evenement destine a un seul flux, pour l'instantane initial d'un nouvel abonne.
	 *
	 * <p>L'ecriture appartient a l'ecrivain du flux, seul et unique : c'est ce qui garantit que
	 * cet instantane precede les diffusions deposees ensuite.
	 */
	void send(SseEmitter emitter, String name, Object data) {
		var stream = streams.get(emitter);
		if (stream != null) {
			stream.offer(new RadarStreamEvent(name, data));
		}
	}

	/** Depose un evenement dans la file de chaque flux ouvert. Retour immediat. */
	void broadcast(String name, Object data) {
		var event = new RadarStreamEvent(name, data);
		for (var stream : streams.values()) {
			stream.offer(event);
		}
	}

	@Override
	public void destroy() {
		for (var stream : streams.values()) {
			stream.close();
		}
	}

	/** Nombre de flux actuellement ouverts, pour les tests et le diagnostic. */
	int openStreams() {
		return streams.size();
	}
}
