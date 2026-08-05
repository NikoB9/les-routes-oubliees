package fr.lesroutesoubliees.routesoubliees.portal;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

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
	PortalMeResponse me(Authentication authentication) {
		return identities.me(principal(authentication));
	}

	@PostMapping("/me/adventurer")
	PortalMeResponse assignAdventurer(
		@Valid @RequestBody PortalAdventurerAssignmentRequest request,
		Authentication authentication
	) {
		return identities.assignAdventurer(principal(authentication), request.adventurerId());
	}

	@PostMapping("/me/guest")
	PortalMeResponse assignGuest(Authentication authentication) {
		return identities.assignGuest(principal(authentication));
	}

	private CloudflareAccessPrincipal principal(Authentication authentication) {
		return (CloudflareAccessPrincipal) authentication.getPrincipal();
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
	List<AdminPortalIdentityResponse> list() {
		return identities.listAdminIdentities();
	}

	@PutMapping("/{id}/assignment")
	AdminPortalIdentityResponse updateAssignment(
		@PathVariable UUID id,
		@Valid @RequestBody AdminPortalAssignmentRequest request,
		Authentication authentication
	) {
		return identities.updateAdminAssignment(id, request, adminIdentity.email(authentication));
	}
}
