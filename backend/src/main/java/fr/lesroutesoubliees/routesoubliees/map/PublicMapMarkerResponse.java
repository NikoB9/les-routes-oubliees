package fr.lesroutesoubliees.routesoubliees.map;

import java.math.BigDecimal;
import java.util.UUID;

public record PublicMapMarkerResponse(
	UUID id,
	String title,
	BigDecimal positionX,
	BigDecimal positionY,
	int displayOrder,
	String questCode
) {
}
