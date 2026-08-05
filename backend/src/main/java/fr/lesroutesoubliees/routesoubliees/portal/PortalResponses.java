package fr.lesroutesoubliees.routesoubliees.portal;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

record PortalMeResponse(
	PortalIdentityResponse identity,
	List<PortalAdventurerChoiceResponse> availableAdventurers,
	boolean guestAvailable
) {
}

record PortalIdentityResponse(
	UUID id,
	PortalAccessMode accessMode,
	UUID adventurerId,
	String displayName,
	String avatarPath,
	OffsetDateTime selectedAt
) {
}

record PortalAdventurerChoiceResponse(
	UUID id,
	String name,
	String title,
	String avatarPath,
	String avatarAlt
) {
}

record AdminPortalIdentityResponse(
	UUID id,
	String normalizedEmail,
	String cloudflareSubject,
	PortalAccessMode accessMode,
	UUID adventurerId,
	String adventurerName,
	OffsetDateTime selectedAt,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
