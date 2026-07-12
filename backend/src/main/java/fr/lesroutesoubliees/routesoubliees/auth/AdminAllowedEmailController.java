package fr.lesroutesoubliees.routesoubliees.auth;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/admin/allowed-emails")
class AdminAllowedEmailController {

	private final AdminAllowlistService allowlist;
	private final AdminIdentity identity;

	AdminAllowedEmailController(AdminAllowlistService allowlist, AdminIdentity identity) {
		this.allowlist = allowlist;
		this.identity = identity;
	}

	@GetMapping
	List<AdminAllowedEmailResponse> listAllowedEmails() {
		return allowlist.listAllowedEmails();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AdminAllowedEmailResponse createAllowedEmail(
		@Valid @RequestBody AdminAllowedEmailCreateRequest request,
		Authentication authentication
	) {
		return allowlist.createAllowedEmail(request, identity.email(authentication));
	}

	@PutMapping("/{id}")
	AdminAllowedEmailResponse updateAllowedEmail(
		@PathVariable UUID id,
		@Valid @RequestBody AdminAllowedEmailUpdateRequest request,
		Authentication authentication
	) {
		return allowlist.updateAllowedEmail(id, request, identity.email(authentication));
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAllowedEmail(@PathVariable UUID id, Authentication authentication) {
		allowlist.deleteAllowedEmail(id, identity.email(authentication));
	}
}
