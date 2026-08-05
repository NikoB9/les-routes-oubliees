package fr.lesroutesoubliees.routesoubliees.portal;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PortalIdentity(
	UUID id,
	String cloudflareSubject,
	String normalizedEmail,
	UUID adventurerId,
	PortalAccessMode accessMode,
	OffsetDateTime selectedAt,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
