package fr.lesroutesoubliees.routesoubliees.map;

import java.time.OffsetDateTime;
import java.util.UUID;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

record AdminMapVisionResponse(
	UUID id,
	String name,
	String descriptionMarkdown,
	String assetPath,
	String imageAlt,
	int displayOrder,
	EditorialStatus status,
	boolean active,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
