package fr.lesroutesoubliees.routesoubliees.shared.security;

public record CloudflareAccessPrincipal(String subject, String email) {

	public String name() {
		return email == null || email.isBlank() ? subject : email;
	}
}
