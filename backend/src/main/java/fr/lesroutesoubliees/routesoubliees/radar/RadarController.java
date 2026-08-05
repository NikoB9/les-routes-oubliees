package fr.lesroutesoubliees.routesoubliees.radar;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
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

	@PostMapping("/treasure-position")
	ResponseEntity<Void> updateTreasurePosition(@Valid @RequestBody TreasurePositionRequest request) {
		radar.updateTreasurePosition(request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}

@RestController
@RequestMapping("/api/admin/radar/settings")
class AdminRadarSettingsController {

	private final RadarService radar;
	private final AdminIdentity identity;

	AdminRadarSettingsController(RadarService radar, AdminIdentity identity) {
		this.radar = radar;
		this.identity = identity;
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
			.body(radar.updateSettings(request, null, identity.email(authentication)));
	}
}

@org.springframework.stereotype.Component
class RadarHeartbeat {

	private final RadarService radar;

	RadarHeartbeat(RadarService radar) {
		this.radar = radar;
	}

	@Scheduled(fixedDelay = 20000)
	void heartbeat() {
		radar.heartbeat();
	}
}
