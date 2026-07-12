package fr.lesroutesoubliees.routesoubliees.home;

import java.time.OffsetDateTime;
import java.util.UUID;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

record AdminHomeMessageResponse(
	UUID id,
	String title,
	String contentMarkdown,
	HomeMessageImportance importance,
	EditorialStatus status,
	boolean active,
	boolean countdownEnabled,
	OffsetDateTime endsAt,
	String expiredMessage,
	String lastModifiedBy,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
