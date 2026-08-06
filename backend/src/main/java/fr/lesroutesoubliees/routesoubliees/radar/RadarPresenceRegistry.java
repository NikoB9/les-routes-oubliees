package fr.lesroutesoubliees.routesoubliees.radar;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import fr.lesroutesoubliees.routesoubliees.portal.PortalIdentity;

@Component
class RadarPresenceRegistry {

	private static final Duration STALE_AFTER = Duration.ofSeconds(15);
	private static final Duration REMOVE_AFTER = Duration.ofSeconds(45);

	/**
	 * Duree pendant laquelle un depart explicite prime sur une publication en vol.
	 *
	 * <p>Le client annule son {@code PUT} avant d'envoyer le {@code DELETE}, mais une
	 * annulation navigateur ne garantit pas que le serveur n'a pas deja commence a traiter
	 * la requete : sans cette fenetre, un {@code PUT} termine apres le {@code DELETE}
	 * recreerait le repere jusqu'a l'expiration du TTL.
	 *
	 * <p>Consequence assumee : un retour sur Radar dans cette fenetre reste invisible aux
	 * autres participants jusqu'a la publication suivante.
	 */
	private static final Duration DEPARTURE_GRACE = Duration.ofSeconds(5);

	private final ConcurrentHashMap<UUID, RadarParticipantResponse> participants = new ConcurrentHashMap<>();
	private final ConcurrentHashMap<UUID, OffsetDateTime> departures = new ConcurrentHashMap<>();
	private final Clock clock;

	RadarPresenceRegistry(Clock clock) {
		this.clock = clock;
	}

	/**
	 * Enregistre la derniere position connue d'une identite.
	 *
	 * <p>La mise a jour est ignoree lorsqu'un depart explicite vient d'etre enregistre, ou
	 * lorsqu'une position strictement plus recente est deja connue.
	 *
	 * @return {@code true} si la position a ete appliquee
	 */
	boolean update(PortalIdentity identity, RadarIdentityResponse display, RadarLocationRequest request) {
		var now = now();
		if (hasRecentDeparture(identity.id(), now)) {
			return false;
		}
		var existing = participants.get(identity.id());
		// L'egalite est acceptee : le heartbeat republie volontairement la meme position,
		// donc le meme observedAt, pour maintenir un aventurier immobile present.
		if (existing != null && existing.observedAt().isAfter(request.observedAt())) {
			return false;
		}
		participants.put(identity.id(), new RadarParticipantResponse(
			identity.id(),
			identity.accessMode(),
			identity.adventurerId(),
			display.displayName(),
			display.avatarPath(),
			request.latitude(),
			request.longitude(),
			request.accuracyM(),
			request.observedAt(),
			now,
			false));
		departures.remove(identity.id());
		return true;
	}

	/**
	 * Retire la presence d'une identite et memorise son depart.
	 *
	 * @return {@code true} si une presence a reellement ete retiree
	 */
	boolean remove(UUID identityId) {
		if (identityId == null) {
			return false;
		}
		departures.put(identityId, now());
		return participants.remove(identityId) != null;
	}

	/**
	 * Vue des presences actives.
	 *
	 * <p>Lecture sans effet de bord : les presences expirees sont exclues sans etre
	 * supprimees, afin que la suppression et sa diffusion restent la responsabilite du
	 * balayage periodique. Une simple lecture ne doit jamais consommer une expiration que
	 * personne n'aurait alors diffusee.
	 */
	List<RadarParticipantResponse> snapshot() {
		var now = now();
		return participants.values().stream()
			.filter(participant -> !isExpired(participant, now))
			.map(participant -> withStaleFlag(participant, now))
			.sorted(Comparator.comparing(RadarParticipantResponse::displayName, Comparator.nullsLast(String::compareToIgnoreCase)))
			.toList();
	}

	/**
	 * Retire les presences dont le dernier releve depasse le TTL, ainsi que les departs
	 * memorises devenus inutiles.
	 *
	 * <p>Seul point de suppression : appele par le balayage periodique du serveur, afin que
	 * l'expiration ne depende ni d'une nouvelle publication ni d'une lecture.
	 *
	 * @return le nombre de presences retirees
	 */
	int pruneExpired() {
		var now = now();
		var removed = 0;
		for (var entry : participants.entrySet()) {
			if (isExpired(entry.getValue(), now) && participants.remove(entry.getKey(), entry.getValue())) {
				removed++;
			}
		}
		departures.entrySet().removeIf(entry -> !isWithinGrace(entry.getValue(), now));
		return removed;
	}

	private boolean hasRecentDeparture(UUID identityId, OffsetDateTime now) {
		var leftAt = departures.get(identityId);
		return leftAt != null && isWithinGrace(leftAt, now);
	}

	private boolean isWithinGrace(OffsetDateTime leftAt, OffsetDateTime now) {
		return Duration.between(leftAt, now).compareTo(DEPARTURE_GRACE) <= 0;
	}

	private boolean isExpired(RadarParticipantResponse participant, OffsetDateTime now) {
		return Duration.between(participant.receivedAt(), now).compareTo(REMOVE_AFTER) > 0;
	}

	private RadarParticipantResponse withStaleFlag(RadarParticipantResponse participant, OffsetDateTime now) {
		var stale = Duration.between(participant.receivedAt(), now).compareTo(STALE_AFTER) > 0;
		return new RadarParticipantResponse(
			participant.identityId(),
			participant.accessMode(),
			participant.adventurerId(),
			participant.displayName(),
			participant.avatarPath(),
			participant.latitude(),
			participant.longitude(),
			participant.accuracyM(),
			participant.observedAt(),
			participant.receivedAt(),
			stale);
	}

	private OffsetDateTime now() {
		return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
	}
}
