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

	private final ConcurrentHashMap<UUID, RadarParticipantResponse> participants = new ConcurrentHashMap<>();
	private final Clock clock;

	RadarPresenceRegistry(Clock clock) {
		this.clock = clock;
	}

	void update(PortalIdentity identity, RadarIdentityResponse display, RadarLocationRequest request) {
		var receivedAt = now();
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
			receivedAt,
			false));
	}

	/**
	 * Retire la presence d'une identite.
	 *
	 * @return {@code true} si une presence a reellement ete retiree
	 */
	boolean remove(UUID identityId) {
		return identityId != null && participants.remove(identityId) != null;
	}

	List<RadarParticipantResponse> snapshot() {
		pruneExpired();
		var now = now();
		return participants.values().stream()
			.map(participant -> withStaleFlag(participant, now))
			.sorted(Comparator.comparing(RadarParticipantResponse::displayName, Comparator.nullsLast(String::compareToIgnoreCase)))
			.toList();
	}

	/**
	 * Retire les presences dont le dernier relevé depasse le TTL.
	 *
	 * <p>Appele par le balayage periodique du serveur : l'expiration ne doit pas dependre
	 * d'une nouvelle publication de position.
	 *
	 * @return le nombre de presences retirees
	 */
	int pruneExpired() {
		var now = now();
		var before = participants.size();
		participants.entrySet()
			.removeIf(entry -> Duration.between(entry.getValue().receivedAt(), now).compareTo(REMOVE_AFTER) > 0);
		return before - participants.size();
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
