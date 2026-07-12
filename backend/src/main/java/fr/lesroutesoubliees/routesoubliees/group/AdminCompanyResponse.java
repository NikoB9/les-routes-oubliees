package fr.lesroutesoubliees.routesoubliees.group;

import java.time.OffsetDateTime;
import java.util.UUID;

record AdminCompanyResponse(
	UUID id,
	String name,
	String emblemPath,
	String imageAlt,
	String shortDescription,
	String longDescriptionMarkdown,
	boolean active,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
