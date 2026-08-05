package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
class AdminSessionController {

	private final AdminIdentity identity;

	AdminSessionController(AdminIdentity identity) {
		this.identity = identity;
	}

	@GetMapping("/me")
	ResponseEntity<AdminSessionResponse> me(Authentication authentication, CsrfToken csrfToken) {
		csrfToken.getToken();
		if (authentication == null || !authentication.isAuthenticated()) {
			return ResponseEntity.ok()
				.cacheControl(org.springframework.http.CacheControl.noStore())
				.body(new AdminSessionResponse(false, null));
		}

		return ResponseEntity.ok()
			.cacheControl(org.springframework.http.CacheControl.noStore())
			.body(new AdminSessionResponse(true, identity.email(authentication)));
	}

}
