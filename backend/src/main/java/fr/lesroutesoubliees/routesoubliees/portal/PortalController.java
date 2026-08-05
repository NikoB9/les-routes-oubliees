package fr.lesroutesoubliees.routesoubliees.portal;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@RestController
@RequestMapping("/api/portal")
class PortalController {

	private final PortalIdentityService identities;

	PortalController(PortalIdentityService identities) {
		this.identities = identities;
	}

	@GetMapping("/me")
	ResponseEntity<PortalMeResponse> me(Authentication authentication) {
		return noStore(withAccess(identities.me(principal(authentication)), authentication));
	}

	@PostMapping("/me/adventurer")
	ResponseEntity<PortalMeResponse> assignAdventurer(
		@Valid @RequestBody PortalAdventurerAssignmentRequest request,
		Authentication authentication
	) {
		return noStore(withAccess(identities.assignAdventurer(principal(authentication), request.adventurerId()), authentication));
	}

	@PostMapping("/me/guest")
	ResponseEntity<PortalMeResponse> assignGuest(Authentication authentication) {
		return noStore(withAccess(identities.assignGuest(principal(authentication)), authentication));
	}

	private CloudflareAccessPrincipal principal(Authentication authentication) {
		return (CloudflareAccessPrincipal) authentication.getPrincipal();
	}

	private ResponseEntity<PortalMeResponse> noStore(PortalMeResponse body) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
	}

	private PortalMeResponse withAccess(PortalMeResponse response, Authentication authentication) {
		return new PortalMeResponse(
			response.identity(),
			response.availableAdventurers(),
			response.guestAvailable(),
			authentication.getAuthorities().stream().anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())));
	}
}

@RestController
@RequestMapping("/api/admin/portal-identities")
class AdminPortalIdentityController {

	private final PortalIdentityService identities;
	private final AdminIdentity adminIdentity;

	AdminPortalIdentityController(PortalIdentityService identities, AdminIdentity adminIdentity) {
		this.identities = identities;
		this.adminIdentity = adminIdentity;
	}

	@GetMapping
	ResponseEntity<List<AdminPortalIdentityResponse>> list() {
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.body(identities.listAdminIdentities());
	}

	@PutMapping("/{id}/assignment")
	ResponseEntity<AdminPortalIdentityResponse> updateAssignment(
		@PathVariable UUID id,
		@Valid @RequestBody AdminPortalAssignmentRequest request,
		Authentication authentication
	) {
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.body(identities.updateAdminAssignment(id, request, adminIdentity.email(authentication)));
	}
}
