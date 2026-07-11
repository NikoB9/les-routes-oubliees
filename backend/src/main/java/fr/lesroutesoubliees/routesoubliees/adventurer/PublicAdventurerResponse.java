package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.UUID;

public record PublicAdventurerResponse(
	UUID id,
	String name,
	String title,
	String avatarPath,
	String avatarAlt,
	String shortDescription,
	String strengths,
	String weaknesses,
	int displayOrder
) {
}
