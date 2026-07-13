package fr.lesroutesoubliees.routesoubliees.map;

import java.util.UUID;

public record PublicMapVisionResponse(
	UUID id,
	String name,
	String descriptionHtml,
	String assetPath,
	String imageAlt,
	int displayOrder
) {
}
