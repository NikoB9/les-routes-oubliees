package fr.lesroutesoubliees.routesoubliees.radar;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Diffusion SSE.
 *
 * <p>Une ecriture SSE est bloquante : ces tests verifient qu'un client qui ne lit plus ne peut
 * ni immobiliser l'appelant, ni retarder les autres participants, ni faire grossir une file
 * sans limite.
 *
 * <p>Emetteurs ecrits a la main plutot que simules : une simulation dont l'ecriture bloque
 * bloque aussi les autres emetteurs du meme cadre, ce qui masquerait precisement l'isolation
 * que ces tests doivent prouver. L'ecriture appartenant au thread de chaque flux, les
 * verifications attendent l'evenement au lieu de supposer un instant.
 */
class RadarEventBroadcasterTests {

	private final RadarEventBroadcaster broadcaster = new RadarEventBroadcaster();

	@AfterEach
	void closeStreams() {
		broadcaster.destroy();
	}

	@Test
	void broadcastsToEveryOpenStream() throws InterruptedException {
		var first = new TestEmitter();
		var second = new TestEmitter();
		broadcaster.attach(first);
		broadcaster.attach(second);

		broadcaster.broadcast("snapshot", "etat");

		assertThat(first.nextWrite()).contains("snapshot").contains("etat");
		assertThat(second.nextWrite()).contains("snapshot").contains("etat");
	}

	@Test
	void closesAndForgetsAStreamThatCannotBeWritten() throws InterruptedException {
		var broken = TestEmitter.failing();
		broadcaster.attach(broken);

		broadcaster.broadcast("snapshot", "etat");

		assertThat(broken.awaitCompletion()).as("l'emetteur en echec doit etre termine").isTrue();
		assertThat(broadcaster.openStreams()).isZero();
	}

	/**
	 * Coeur du correctif : un client muet ne doit plus retarder les instantanes des autres.
	 * L'appelant, balayage periodique ou thread de requete, rend la main immediatement.
	 */
	@Test
	void aStalledStreamNeitherBlocksTheCallerNorDelaysTheOthers() throws InterruptedException {
		var release = new CountDownLatch(1);
		var stalled = TestEmitter.stalling(release);
		var healthy = new TestEmitter();
		broadcaster.attach(stalled);
		broadcaster.attach(healthy);

		try {
			broadcaster.broadcast("snapshot", "premier etat");
			broadcaster.broadcast("snapshot", "second etat");

			// Le flux sain recoit ses deux evenements alors que l'autre reste bloque.
			assertThat(healthy.nextWrite()).contains("premier etat");
			assertThat(healthy.nextWrite()).contains("second etat");
			assertThat(broadcaster.openStreams())
				.as("le flux bloque reste ouvert : il n'est lache qu'a saturation de sa file")
				.isEqualTo(2);
		}
		finally {
			release.countDown();
		}
	}

	/**
	 * Une erreur inattendue — un echec de serialisation en est l'exemple realiste — doit etre
	 * traitee comme un echec d'ecriture, et non tuer l'ecrivain avec une trace brute.
	 */
	@Test
	void closesAndForgetsAStreamWhoseWriteFailsUnexpectedly() throws InterruptedException {
		var broken = TestEmitter.failingUnexpectedly();
		broadcaster.attach(broken);

		broadcaster.broadcast("snapshot", "etat");

		assertThat(broken.awaitCompletion()).as("l'emetteur en echec doit etre termine").isTrue();
		assertThat(broadcaster.openStreams()).isZero();
	}

	/**
	 * La file d'un flux est bornee : un client qui ne suit pas est lache au lieu d'accumuler
	 * indefiniment. Il se reconnectera et recevra un etat frais.
	 */
	@Test
	void dropsAStreamThatCannotKeepUp() throws InterruptedException {
		var release = new CountDownLatch(1);
		var stalled = TestEmitter.stalling(release);
		broadcaster.attach(stalled);

		try {
			for (var event = 0; event < 40; event++) {
				broadcaster.broadcast("snapshot", "etat " + event);
			}

			// Aucune diffusion n'a attendu, et le retrait est decide par le depot lui-meme,
			// donc deja effectif au retour de la boucle.
			assertThat(broadcaster.openStreams())
				.as("le flux sature doit quitter le registre")
				.isZero();
		}
		finally {
			release.countDown();
		}

		// L'emetteur lache n'est termine que par son propre ecrivain, une fois debloque.
		assertThat(stalled.awaitCompletion()).as("l'emetteur lache doit etre termine").isTrue();
	}

	@Test
	void stopsEveryWriterOnShutdown() throws InterruptedException {
		var emitter = new TestEmitter();
		broadcaster.attach(emitter);

		broadcaster.destroy();

		assertThat(emitter.awaitCompletion()).as("l'ecrivain doit s'arreter et terminer son flux").isTrue();
		assertThat(broadcaster.openStreams()).isZero();
	}

	/**
	 * Emetteur enregistrant ce qui lui est ecrit, capable d'echouer ou de rester bloque.
	 *
	 * <p>{@code complete()} n'appelle pas la version parente : sans conteneur, seule la
	 * fermeture est a observer.
	 */
	private static final class TestEmitter extends SseEmitter {

		private static final long TIMEOUT_MS = 2000;

		private final BlockingQueue<String> written = new LinkedBlockingQueue<>();
		private final CountDownLatch completed = new CountDownLatch(1);
		private final CountDownLatch release;
		private final Failure failure;

		private TestEmitter(CountDownLatch release, Failure failure) {
			this.release = release;
			this.failure = failure;
		}

		private TestEmitter() {
			this(null, Failure.NONE);
		}

		static TestEmitter failing() {
			return new TestEmitter(null, Failure.IO);
		}

		/** Echec hors du contrat d'ecriture : ni {@code IOException} ni {@code IllegalStateException}. */
		static TestEmitter failingUnexpectedly() {
			return new TestEmitter(null, Failure.UNEXPECTED);
		}

		/** L'ecriture reste bloquee jusqu'au deverrouillage, comme un client qui ne lit plus. */
		static TestEmitter stalling(CountDownLatch release) {
			return new TestEmitter(release, Failure.NONE);
		}

		@Override
		public void send(SseEventBuilder builder) throws IOException {
			if (failure == Failure.IO) {
				throw new IOException("flux ferme");
			}
			if (failure == Failure.UNEXPECTED) {
				throw new IllegalArgumentException("charge non serialisable");
			}
			written.add(render(builder));
			if (release != null) {
				try {
					release.await(10, TimeUnit.SECONDS);
				}
				catch (InterruptedException exception) {
					Thread.currentThread().interrupt();
				}
			}
		}

		@Override
		public void complete() {
			completed.countDown();
		}

		/** Prochain evenement ecrit, sous forme textuelle. Echoue si rien n'arrive. */
		String nextWrite() throws InterruptedException {
			var event = written.poll(TIMEOUT_MS, TimeUnit.MILLISECONDS);
			assertThat(event).as("un evenement doit etre ecrit dans le flux").isNotNull();
			return event;
		}

		boolean awaitCompletion() throws InterruptedException {
			return completed.await(TIMEOUT_MS, TimeUnit.MILLISECONDS);
		}

		/** Nature de l'echec simule a l'ecriture. */
		private enum Failure {

			NONE, IO, UNEXPECTED
		}

		private static String render(SseEventBuilder builder) {
			var text = new StringBuilder();
			for (var part : builder.build()) {
				text.append(part.getData());
			}
			return text.toString();
		}
	}
}
