package fr.lesroutesoubliees.routesoubliees.auth;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminAllowedEmailResponse(
	UUID id,
	String email,
	String label,
	boolean active,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {

	static AdminAllowedEmailResponse from(AdminAllowedEmail allowedEmail) {
		return new AdminAllowedEmailResponse(
			allowedEmail.id(),
			allowedEmail.email(),
			allowedEmail.label(),
			allowedEmail.active(),
			allowedEmail.createdAt(),
			allowedEmail.updatedAt());
	}
}
