package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.time.OffsetDateTime;
import java.util.UUID;

record AdminAdventurerResponse(
	UUID id,
	String name,
	String title,
	String avatarPath,
	String avatarAlt,
	String shortDescription,
	String strengths,
	String weaknesses,
	boolean visible,
	int displayOrder,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
