package fr.lesroutesoubliees.routesoubliees.radar;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import fr.lesroutesoubliees.routesoubliees.portal.PortalAccessMode;
import fr.lesroutesoubliees.routesoubliees.portal.PortalIdentity;

@Component
class RadarPresenceRegistry {

	private static final Duration STALE_AFTER = Duration.ofSeconds(15);
	private static final Duration REMOVE_AFTER = Duration.ofSeconds(45);

	private final ConcurrentHashMap<UUID, RadarParticipantResponse> participants = new ConcurrentHashMap<>();

	void update(PortalIdentity identity, RadarIdentityResponse display, RadarLocationRequest request) {
		var receivedAt = OffsetDateTime.now(ZoneOffset.UTC);
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

	List<RadarParticipantResponse> snapshot() {
		prune();
		var now = OffsetDateTime.now(ZoneOffset.UTC);
		return participants.values().stream()
			.map(participant -> withStaleFlag(participant, now))
			.sorted(Comparator.comparing(RadarParticipantResponse::displayName, Comparator.nullsLast(String::compareToIgnoreCase)))
			.toList();
	}

	private void prune() {
		var now = OffsetDateTime.now(ZoneOffset.UTC);
		participants.entrySet().removeIf(entry -> Duration.between(entry.getValue().receivedAt(), now).compareTo(REMOVE_AFTER) > 0);
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
}
