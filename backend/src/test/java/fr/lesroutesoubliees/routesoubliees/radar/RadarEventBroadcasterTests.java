package fr.lesroutesoubliees.routesoubliees.radar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Diffusion SSE.
 *
 * <p>Une ecriture SSE est bloquante : ces tests verifient qu'un client qui ne lit plus ne
 * peut pas immobiliser l'appelant, ce qui suspendrait le balayage des presences pour tous
 * les participants.
 *
 * <p>L'ordre des instantanes n'est pas teste ici : il decoule de la construction, un seul
 * thread traitant une seule tache par diffusion.
 */
class RadarEventBroadcasterTests {

	/** Executeur direct : rend les assertions deterministes, sans attente. */
	private static final Executor DIRECT = Runnable::run;

	@Test
	void broadcastsToEveryOpenStream() throws IOException {
		var broadcaster = new RadarEventBroadcaster(DIRECT);
		var first = broadcaster.attach(mock(SseEmitter.class));
		var second = broadcaster.attach(mock(SseEmitter.class));

		broadcaster.broadcast("snapshot", "etat");

		verify(first).send(any(SseEmitter.SseEventBuilder.class));
		verify(second).send(any(SseEmitter.SseEventBuilder.class));
	}

	@Test
	void closesAndForgetsAStreamThatCannotBeWritten() throws IOException {
		var broadcaster = new RadarEventBroadcaster(DIRECT);
		var broken = mock(SseEmitter.class);
		willThrow(new IOException("flux ferme")).given(broken).send(any(SseEmitter.SseEventBuilder.class));
		broadcaster.attach(broken);

		broadcaster.broadcast("snapshot", "etat");

		verify(broken).complete();
		assertThat(broadcaster.openStreams()).isZero();
	}

	/**
	 * Coeur du probleme corrige : l'appelant — balayage periodique ou thread de requete —
	 * doit rendre la main immediatement, meme si une ecriture reste bloquee.
	 */
	@Test
	void neverBlocksTheCallerWhenAStreamStalls() throws Exception {
		var broadcaster = new RadarEventBroadcaster(RadarDeliveryExecutor.create());
		var writing = new CountDownLatch(1);
		var release = new CountDownLatch(1);
		var stalled = mock(SseEmitter.class);
		willAnswer((invocation) -> {
			writing.countDown();
			release.await(5, TimeUnit.SECONDS);
			return null;
		}).given(stalled).send(any(SseEmitter.SseEventBuilder.class));
		broadcaster.attach(stalled);

		try {
			broadcaster.broadcast("snapshot", "etat");

			assertThat(writing.await(5, TimeUnit.SECONDS))
				.as("la diffusion doit demarrer sur le thread dedie")
				.isTrue();

			// L'appelant est deja revenu : une seconde diffusion est acceptee sans attendre la
			// premiere, qui reste bloquee sur le client muet.
			broadcaster.broadcast("snapshot", "etat suivant");
		}
		finally {
			release.countDown();
		}
	}
}
