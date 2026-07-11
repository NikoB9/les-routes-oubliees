package fr.lesroutesoubliees.routesoubliees.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
class AdminSessionController {

	@GetMapping("/me")
	AdminSessionResponse me(Authentication authentication) {
		if (authentication == null || !authentication.isAuthenticated()) {
			return new AdminSessionResponse(false, null);
		}

		return new AdminSessionResponse(true, email(authentication));
	}

	@PostMapping("/logout")
	ResponseEntity<Void> logout(
		Authentication authentication,
		HttpServletRequest request,
		HttpServletResponse response
	) {
		new SecurityContextLogoutHandler().logout(request, response, authentication);
		SecurityContextHolder.clearContext();
		return ResponseEntity.noContent().build();
	}

	private String email(Authentication authentication) {
		if (authentication.getPrincipal() instanceof OidcUser oidcUser) {
			return oidcUser.getEmail();
		}
		return authentication.getName();
	}
}
