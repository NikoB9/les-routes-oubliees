package fr.lesroutesoubliees.routesoubliees.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminAllowedEmailCreateRequest(
	@NotBlank @Email @Size(max = 320) String email,
	@Size(max = 120) String label
) {
}
