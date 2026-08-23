package fr.lesroutesoubliees.routesoubliees.radar;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
import fr.lesroutesoubliees.routesoubliees.portal.PortalIdentityService;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@RestController
@RequestMapping("/api/radar")
class RadarController {

	private final RadarService radar;

	RadarController(RadarService radar) {
		this.radar = radar;
	}

	@GetMapping("/snapshot")
	ResponseEntity<RadarSnapshotResponse> snapshot(Authentication authentication) {
		return noStore(radar.snapshot(principal(authentication)));
	}

	@GetMapping(path = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	ResponseEntity<SseEmitter> events(Authentication authentication) {
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.body(radar.events(principal(authentication)));
	}

	@PutMapping("/me/location")
	ResponseEntity<Void> updateMyLocation(
		@Valid @RequestBody RadarLocationRequest request,
		Authentication authentication
	) {
		radar.updateMyLocation(principal(authentication), request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	/**
	 * Retire la presence de l'utilisateur authentifie lors d'une sortie normale de Radar.
	 *
	 * <p>Aucun identifiant fourni par le client n'est accepte : seule l'identite issue du
	 * JWT valide est utilisee. L'operation est idempotente.
	 */
	@DeleteMapping("/me/location")
	ResponseEntity<Void> removeMyLocation(Authentication authentication) {
		radar.removeMyLocation(principal(authentication));
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	private CloudflareAccessPrincipal principal(Authentication authentication) {
		return (CloudflareAccessPrincipal) authentication.getPrincipal();
	}

	private ResponseEntity<RadarSnapshotResponse> noStore(RadarSnapshotResponse body) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
	}
}

@RestController
@RequestMapping("/api/integrations/home-assistant/radar")
class HomeAssistantRadarController {

	private final RadarService radar;

	HomeAssistantRadarController(RadarService radar) {
		this.radar = radar;
	}

	/**
	 * Publie un releve tresor.
	 *
	 * <p>{@code 204 No Content} lorsque la mesure est appliquee, {@code 200 OK} avec un
	 * statut minimal lorsqu'elle est ignoree car non strictement plus recente. La mise a
	 * jour n'etant jamais differee, {@code 202 Accepted} serait trompeur.
	 */
	@PostMapping("/treasure-position")
	ResponseEntity<TreasureUpdateStatusResponse> updateTreasurePosition(
		@Valid @RequestBody TreasurePositionRequest request
	) {
		var outcome = radar.updateTreasurePosition(request);
		if (outcome == TreasureUpdateOutcome.APPLIED) {
			return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
		}
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.body(TreasureUpdateStatusResponse.ignored());
	}
}

@RestController
@RequestMapping("/api/admin/radar/points")
class AdminRadarPointController {

	private final RadarPointService points;
	private final RadarService radar;
	private final AdminIdentity identity;

	AdminRadarPointController(RadarPointService points, RadarService radar, AdminIdentity identity) {
		this.points = points;
		this.radar = radar;
		this.identity = identity;
	}

	@GetMapping
	ResponseEntity<java.util.List<AdminRadarPointResponse>> listPoints() {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(points.listAdminPoints());
	}

	@PostMapping(path = "/import-carte", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	ResponseEntity<java.util.List<AdminRadarPointResponse>> importCarte(
		@RequestParam("file") MultipartFile file,
		Authentication authentication
	) {
		var imported = points.importCarte(file, identity.email(authentication));
		radar.broadcastCurrentState();
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(imported);
	}

	@PutMapping("/{id}")
	ResponseEntity<AdminRadarPointResponse> updatePoint(
		@PathVariable UUID id,
		@Valid @RequestBody AdminRadarPointUpdateRequest request,
		Authentication authentication
	) {
		var updated = points.updatePoint(id, request, identity.email(authentication));
		radar.broadcastCurrentState();
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(updated);
	}

	@DeleteMapping("/{id}")
	ResponseEntity<Void> deletePoint(@PathVariable UUID id, Authentication authentication) {
		points.deletePoint(id, identity.email(authentication));
		radar.broadcastCurrentState();
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}

@RestController
@RequestMapping("/api/admin/radar/settings")
class AdminRadarSettingsController {

	private final RadarService radar;
	private final AdminIdentity identity;
	private final PortalIdentityService identities;

	AdminRadarSettingsController(RadarService radar, AdminIdentity identity, PortalIdentityService identities) {
		this.radar = radar;
		this.identity = identity;
		this.identities = identities;
	}

	@GetMapping
	ResponseEntity<AdminRadarSettingsResponse> settings() {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(radar.settings());
	}

	@PutMapping
	ResponseEntity<AdminRadarSettingsResponse> update(
		@Valid @RequestBody AdminRadarSettingsUpdateRequest request,
		Authentication authentication
	) {
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.body(radar.updateSettings(request, actorIdentityId(authentication), identity.email(authentication)));
	}

	/**
	 * Identite portail de l'administrateur agissant.
	 *
	 * <p>La colonne {@code treasure_visibility_updated_by} reference
	 * {@code portal_identities} : elle reste nulle pour un administrateur qui n'a jamais
	 * choisi de personnage. La trace de reference demeure {@code audit_logs}, qui enregistre
	 * l'adresse de l'acteur.
	 */
	private UUID actorIdentityId(Authentication authentication) {
		if (authentication == null || !(authentication.getPrincipal() instanceof CloudflareAccessPrincipal principal)) {
			return null;
		}
		return identities.findIdentityId(principal).orElse(null);
	}
}

@org.springframework.stereotype.Component
class RadarHeartbeat {

	/** Intervalle du balayage des presences expirees, en millisecondes. */
	static final long PRESENCE_SWEEP_INTERVAL_MS = 5000;

	private final RadarService radar;

	RadarHeartbeat(RadarService radar) {
		this.radar = radar;
	}

	@Scheduled(fixedDelay = 20000)
	void heartbeat() {
		radar.heartbeat();
	}

	/**
	 * Retire les presences expirees et diffuse leur disparition sans attendre une nouvelle
	 * publication de position.
	 */
	@Scheduled(fixedDelay = PRESENCE_SWEEP_INTERVAL_MS)
	void sweepExpiredPresences() {
		radar.sweepExpiredPresences();
	}
}
