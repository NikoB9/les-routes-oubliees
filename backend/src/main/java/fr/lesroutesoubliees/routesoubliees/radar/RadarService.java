package fr.lesroutesoubliees.routesoubliees.radar;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;
import fr.lesroutesoubliees.routesoubliees.portal.PortalAccessMode;
import fr.lesroutesoubliees.routesoubliees.portal.PortalIdentity;
import fr.lesroutesoubliees.routesoubliees.portal.PortalIdentityService;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Service
class RadarService {

	private static final Logger LOGGER = LoggerFactory.getLogger(RadarService.class);

	private static final String TREASURE_BEACON = "tresor-aurelune";
	private static final long SSE_TIMEOUT_MS = Duration.ofHours(1).toMillis();

	private final JdbcTemplate jdbc;
	private final PortalIdentityService identities;
	private final RadarPresenceRegistry presence;
	private final RadarPointService points;
	private final AuditService audit;
	private final RadarEventBroadcaster events;
	private final Clock clock;

	RadarService(
		JdbcTemplate jdbc,
		PortalIdentityService identities,
		RadarPresenceRegistry presence,
		RadarPointService points,
		AuditService audit,
		RadarEventBroadcaster events,
		Clock clock
	) {
		this.jdbc = jdbc;
		this.identities = identities;
		this.presence = presence;
		this.points = points;
		this.audit = audit;
		this.events = events;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	RadarSnapshotResponse snapshot(CloudflareAccessPrincipal principal) {
		var identity = identities.requireAssignedIdentity(principal);
		return buildSnapshot(identity);
	}

	@Transactional
	void updateMyLocation(CloudflareAccessPrincipal principal, RadarLocationRequest request) {
		validateObservedAt(request.observedAt());
		var identity = identities.requireAssignedIdentity(principal);
		var display = identityDisplay(identity);
		if (presence.update(identity, display, request)) {
			broadcast();
		}
	}

	/**
	 * Retire la presence de l'utilisateur authentifie.
	 *
	 * <p>Idempotent : l'absence de presence n'est pas une erreur. La diffusion est
	 * inconditionnelle afin que le repere disparaisse immediatement chez les autres
	 * participants.
	 */
	@Transactional
	void removeMyLocation(CloudflareAccessPrincipal principal) {
		var identity = identities.requireAssignedIdentity(principal);
		presence.remove(identity.id());
		broadcast();
	}

	/**
	 * Applique un releve tresor uniquement s'il est strictement plus recent.
	 *
	 * @return {@link TreasureUpdateOutcome#APPLIED} si la mise a jour atomique a touche la
	 *     ligne, {@link TreasureUpdateOutcome#IGNORED} sinon
	 */
	@Transactional
	TreasureUpdateOutcome updateTreasurePosition(TreasurePositionRequest request) {
		if (request.schemaVersion() != 1 || !TREASURE_BEACON.equals(request.beacon())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Balise Radar invalide.");
		}
		validateObservedAt(request.observedAt());
		var updatedRows = jdbc.update("""
			update radar_state
			set treasure_latitude = ?, treasure_longitude = ?, treasure_accuracy_m = ?,
			    treasure_observed_at = ?, treasure_received_at = ?
			where id = 1
			  and (treasure_observed_at is null or treasure_observed_at < ?)
			""", request.latitude(), request.longitude(), request.accuracyM(), request.observedAt(), now(), request.observedAt());
		if (updatedRows > 0) {
			broadcast();
			return TreasureUpdateOutcome.APPLIED;
		}
		return TreasureUpdateOutcome.IGNORED;
	}

	@Transactional(readOnly = true)
	AdminRadarSettingsResponse settings() {
		return new AdminRadarSettingsResponse(treasureVisible(), treasure(true));
	}

	@Transactional
	AdminRadarSettingsResponse updateSettings(AdminRadarSettingsUpdateRequest request, UUID actorIdentityId, String actorEmail) {
		jdbc.update("""
			update radar_state
			set treasure_visible = ?, treasure_visibility_updated_by = ?, treasure_visibility_updated_at = ?
			where id = 1
			""", request.treasureVisible(), actorIdentityId, now());
		audit.record(actorEmail, "RADAR_TREASURE_VISIBILITY_UPDATED", "RADAR_STATE", "1",
			"Visibilite du tresor mise a jour");
		broadcast();
		return settings();
	}

	@Transactional(readOnly = true)
	SseEmitter events(CloudflareAccessPrincipal principal) {
		var identity = identities.requireAssignedIdentity(principal);
		var emitter = events.register(SSE_TIMEOUT_MS);
		events.send(emitter, "snapshot", buildSnapshot(identity));
		events.send(emitter, "heartbeat", java.util.Map.of("serverTime", now()));
		return emitter;
	}

	void heartbeat() {
		events.broadcast("heartbeat", java.util.Map.of("serverTime", now()));
	}

	/**
	 * Filet de securite obligatoire : retire les presences expirees et diffuse le nouvel
	 * etat, meme si personne ne publie plus de position.
	 *
	 * @return le nombre de presences retirees
	 */
	int sweepExpiredPresences() {
		var removed = presence.pruneExpired();
		if (removed > 0) {
			LOGGER.debug("Balayage Radar : {} presence(s) expiree(s) retiree(s).", removed);
			broadcast();
		}
		return removed;
	}

	void broadcastCurrentState() {
		broadcast();
	}

	/**
	 * Diffuse le nouvel etat aux flux ouverts.
	 *
	 * <p>Lorsqu'une transaction est en cours, la diffusion est reportee apres le commit :
	 * un etat construit a partir de donnees non encore validees ne doit jamais atteindre les
	 * abonnes, sous peine de laisser un repere fantome si la transaction est annulee.
	 */
	private void broadcast() {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {

				@Override
				public void afterCommit() {
					events.broadcast("snapshot", buildAnonymousSnapshot());
				}
			});
			return;
		}
		events.broadcast("snapshot", buildAnonymousSnapshot());
	}

	private RadarSnapshotResponse buildSnapshot(PortalIdentity identity) {
		return new RadarSnapshotResponse(now(), identityDisplay(identity), treasure(false), points.activePoints(), presence.snapshot());
	}

	private RadarSnapshotResponse buildAnonymousSnapshot() {
		return new RadarSnapshotResponse(now(), null, treasure(false), points.activePoints(), presence.snapshot());
	}

	private RadarIdentityResponse identityDisplay(PortalIdentity identity) {
		if (identity.accessMode() == PortalAccessMode.GUEST) {
			return new RadarIdentityResponse(identity.id(), PortalAccessMode.GUEST, null, "Ombre de la Compagnie", null);
		}
		var rows = jdbc.query("""
			select id, name, avatar_path
			from adventurers
			where id = ?
			""", (rs, rowNum) -> new RadarIdentityResponse(
			identity.id(),
			PortalAccessMode.ADVENTURER,
			rs.getObject("id", UUID.class),
			rs.getString("name"),
			rs.getString("avatar_path")), identity.adventurerId());
		return rows.isEmpty()
			? new RadarIdentityResponse(identity.id(), identity.accessMode(), identity.adventurerId(), "Aventurier masque", null)
			: rows.getFirst();
	}

	private RadarTreasureResponse treasure(boolean includeWhenHidden) {
		var rows = jdbc.query("""
			select treasure_visible, treasure_latitude, treasure_longitude, treasure_accuracy_m,
			       treasure_observed_at, treasure_received_at
			from radar_state
			where id = 1
			""", this::mapTreasure);
		if (rows.isEmpty()) {
			return null;
		}
		var row = rows.getFirst();
		if (row == null) {
			return null;
		}
		if (!includeWhenHidden && !treasureVisible()) {
			return null;
		}
		return row;
	}

	private boolean treasureVisible() {
		var visible = jdbc.queryForObject("select treasure_visible from radar_state where id = 1", Boolean.class);
		return Boolean.TRUE.equals(visible);
	}

	private RadarTreasureResponse mapTreasure(ResultSet rs, int rowNum) throws SQLException {
		var latitude = rs.getObject("treasure_latitude");
		var longitude = rs.getObject("treasure_longitude");
		var accuracy = rs.getObject("treasure_accuracy_m");
		var observedAt = offset(rs.getTimestamp("treasure_observed_at"));
		var receivedAt = offset(rs.getTimestamp("treasure_received_at"));
		if (latitude == null || longitude == null || accuracy == null || observedAt == null || receivedAt == null) {
			return null;
		}
		var stale = Duration.between(observedAt, now()).compareTo(Duration.ofMinutes(5)) > 0;
		return new RadarTreasureResponse(
			rs.getDouble("treasure_latitude"),
			rs.getDouble("treasure_longitude"),
			rs.getDouble("treasure_accuracy_m"),
			observedAt,
			receivedAt,
			stale);
	}

	private void validateObservedAt(OffsetDateTime observedAt) {
		if (observedAt.isAfter(now().plusMinutes(2))) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Horodatage futur invalide.");
		}
	}

	private OffsetDateTime now() {
		return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
	}

	private OffsetDateTime offset(Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
	}
}
