package fr.lesroutesoubliees.routesoubliees.auth;

import jakarta.validation.constraints.Size;

public record AdminAllowedEmailUpdateRequest(
	@Size(max = 120) String label,
	boolean active
) {
}
