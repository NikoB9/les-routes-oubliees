package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Component
public class AdminIdentity {

	public String email(Authentication authentication) {
		if (authentication == null || !authentication.isAuthenticated()) {
			return null;
		}
		if (authentication.getPrincipal() instanceof CloudflareAccessPrincipal principal) {
			return principal.email();
		}
		return authentication.getName();
	}
}
