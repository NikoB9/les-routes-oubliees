package fr.lesroutesoubliees.routesoubliees.group;

import java.util.UUID;

public record PublicCompanyResponse(
	UUID id,
	String name,
	String emblemPath,
	String imageAlt,
	String shortDescription,
	String longDescriptionMarkdown
) {
}
