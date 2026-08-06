package fr.lesroutesoubliees.routesoubliees.radar;

import java.io.IOException;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Un flux SSE Radar et son unique ecrivain.
 *
 * <p>Une ecriture SSE est bloquante : un client qui ne lit plus sans fermer sa connexion
 * remplit le tampon reseau et immobilise le thread qui ecrit. Chaque flux possede donc sa
 * file et son thread, et un client bloque ne retarde plus que lui-meme. Le diffuseur, lui,
 * ne fait que deposer : il n'est jamais dans le chemin d'ecriture.
 *
 * <p>Thread virtuel et non place de pool : une ecriture bloquee gare le thread au lieu de
 * consommer une ressource partagee, donc l'isolation ne depend d'aucune taille de pool. Le
 * nombre de threads reste borne par le nombre de flux ouverts, chacun n'ayant qu'un ecrivain.
 *
 * <p>Un seul ecrivain par flux garantit aussi l'ordre : l'instantane initial et les
 * diffusions suivantes passent par la meme file.
 */
final class RadarStream {

	private static final Logger LOGGER = LoggerFactory.getLogger(RadarStream.class);

	/**
	 * Environ 80 secondes de heartbeats : au-dela, le client ne suit visiblement plus.
	 *
	 * <p>C'est aussi la tolerance aux rafales, l'ecrivain devant etre ordonnance pour vider la
	 * file. Le rythme reel reste de quelques diffusions par seconde — une publication toutes
	 * les sept secondes par participant, un balayage toutes les cinq secondes, un heartbeat
	 * toutes les vingt.
	 */
	private static final int MAILBOX_CAPACITY = 16;

	private final SseEmitter emitter;
	private final BlockingQueue<RadarStreamEvent> mailbox = new ArrayBlockingQueue<>(MAILBOX_CAPACITY);
	private final AtomicBoolean closing = new AtomicBoolean();
	private final Consumer<RadarStream> onClosing;

	private volatile Thread writer;

	RadarStream(SseEmitter emitter, Consumer<RadarStream> onClosing) {
		this.emitter = emitter;
		this.onClosing = onClosing;
	}

	/**
	 * Demarre l'unique ecrivain du flux.
	 *
	 * <p>Trois lignes indissociables, contre une fermeture concurrente du demarrage. L'ecrivain
	 * est publie avant d'etre demarre, pour qu'un {@link #close()} simultane le trouve et
	 * l'interrompe. Le controle final couvre le cas inverse, celui d'une fermeture anterieure a
	 * cette publication : interrompre alors un thread desormais vivant est pleinement defini,
	 * la ou {@link Thread#interrupt()} ne garantit aucun effet sur un thread pas encore
	 * demarre. Sans ce filet, l'ecrivain pouvait rester gare pour toujours sur {@code take()},
	 * pour un flux deja retire du registre que plus personne n'alimenterait.
	 */
	void start(String threadName) {
		var thread = Thread.ofVirtual().name(threadName).unstarted(this::drain);
		this.writer = thread;
		thread.start();
		if (closing.get()) {
			thread.interrupt();
		}
	}

	/**
	 * Depose un evenement sans jamais bloquer l'appelant.
	 *
	 * <p>File pleine : le client est lache plutot que suivi indefiniment. Un instantane etant
	 * un etat complet, l'abandonner silencieusement laisserait ce client perime sans qu'il le
	 * sache ; ferme, il se reconnecte en quelques secondes et recoit un etat frais.
	 *
	 * <p>L'emetteur n'est volontairement pas termine ici : {@code complete()} peut attendre le
	 * verrou d'ecriture, ce qui rebloquerait le diffuseur. C'est l'ecrivain qui le termine a
	 * son reveil.
	 */
	void offer(RadarStreamEvent event) {
		if (closing.get()) {
			return;
		}
		if (mailbox.offer(event)) {
			return;
		}
		if (markClosing()) {
			LOGGER.warn("Flux Radar lache : le client ne suit plus le rythme des diffusions.");
		}
	}

	/**
	 * Ferme le flux depuis l'exterieur : rappel du conteneur ou arret du contexte.
	 *
	 * <p>Seul endroit ou l'ecrivain est interrompu. Reveiller un thread gare sur la file est
	 * sans risque. Interrompre une ecriture en cours l'est tout autant ici, non parce que ce
	 * serait reserve a l'arret — {@code onCompletion}, {@code onTimeout} et {@code onError}
	 * declenchent cette fermeture en exploitation normale — mais parce que ces rappels
	 * n'arrivent que sur une reponse deja terminee ou mourante : l'ecriture interrompue n'avait
	 * plus de destinataire.
	 */
	void close() {
		if (!markClosing()) {
			return;
		}
		var thread = this.writer;
		if (thread != null && thread != Thread.currentThread()) {
			thread.interrupt();
		}
	}

	private boolean markClosing() {
		if (!closing.compareAndSet(false, true)) {
			return false;
		}
		onClosing.accept(this);
		return true;
	}

	private void drain() {
		var interrupted = false;
		try {
			while (!closing.get()) {
				var event = mailbox.take();
				if (closing.get()) {
					break;
				}
				emitter.send(SseEmitter.event().name(event.name()).data(event.data()));
			}
		}
		catch (InterruptedException exception) {
			interrupted = true;
		}
		catch (IOException | IllegalStateException exception) {
			LOGGER.debug("Flux Radar retire apres un echec d'ecriture.", exception);
		}
		// Une erreur inattendue — un echec de serialisation, par exemple — tuerait sinon le
		// thread avec une trace brute sur la sortie d'erreur. Jackson nomme le chemin de la
		// propriete fautive, jamais sa valeur : aucune position ne fuit par ce journal.
		catch (RuntimeException exception) {
			LOGGER.warn("Flux Radar retire apres une erreur inattendue a l'ecriture.", exception);
		}
		finally {
			markClosing();
			completeQuietly();
			if (interrupted) {
				Thread.currentThread().interrupt();
			}
		}
	}

	private void completeQuietly() {
		try {
			emitter.complete();
		}
		catch (RuntimeException exception) {
			LOGGER.debug("Fermeture d'un flux Radar deja termine.", exception);
		}
	}
}

/** Evenement destine a un flux SSE : un nom et une charge deja prete a serialiser. */
record RadarStreamEvent(String name, Object data) {
}
