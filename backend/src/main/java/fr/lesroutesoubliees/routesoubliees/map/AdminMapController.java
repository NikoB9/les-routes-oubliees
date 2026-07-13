package fr.lesroutesoubliees.routesoubliees.map;

import java.util.List;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/admin")
class AdminMapController {

	private final AdminMapService maps;
	private final AdminIdentity identity;

	AdminMapController(AdminMapService maps, AdminIdentity identity) {
		this.maps = maps;
		this.identity = identity;
	}

	@GetMapping("/map-views")
	List<AdminMapVisionResponse> listVisions() {
		return maps.listVisions();
	}

	@PostMapping("/map-views")
	AdminMapVisionResponse createVision(
		@Valid @RequestBody AdminMapVisionUpsertRequest request,
		Authentication authentication
	) {
		return maps.createVision(request, identity.email(authentication));
	}

	@GetMapping("/map-views/{id}")
	AdminMapVisionResponse getVision(@PathVariable UUID id) {
		return maps.getVision(id);
	}

	@PutMapping("/map-views/{id}")
	AdminMapVisionResponse updateVision(
		@PathVariable UUID id,
		@Valid @RequestBody AdminMapVisionUpsertRequest request,
		Authentication authentication
	) {
		return maps.updateVision(id, request, identity.email(authentication));
	}

	@PostMapping("/map-views/{id}/activate")
	AdminMapVisionResponse activateVision(@PathVariable UUID id, Authentication authentication) {
		return maps.activateVision(id, identity.email(authentication));
	}

	@DeleteMapping("/map-views/{id}")
	void deleteVision(@PathVariable UUID id, Authentication authentication) {
		maps.deleteVision(id, identity.email(authentication));
	}

	@GetMapping("/map-markers")
	List<AdminMapMarkerResponse> listMarkers() {
		return maps.listMarkers();
	}

	@PostMapping("/map-markers")
	AdminMapMarkerResponse createMarker(
		@Valid @RequestBody AdminMapMarkerUpsertRequest request,
		Authentication authentication
	) {
		return maps.createMarker(request, identity.email(authentication));
	}

	@PutMapping("/map-markers/{id}")
	AdminMapMarkerResponse updateMarker(
		@PathVariable UUID id,
		@Valid @RequestBody AdminMapMarkerUpsertRequest request,
		Authentication authentication
	) {
		return maps.updateMarker(id, request, identity.email(authentication));
	}

	@DeleteMapping("/map-markers/{id}")
	void deleteMarker(@PathVariable UUID id, Authentication authentication) {
		maps.deleteMarker(id, identity.email(authentication));
	}

	@GetMapping("/map-preview")
	AdminMapPreviewResponse preview(@RequestParam UUID visionId) {
		return maps.preview(visionId);
	}
}
