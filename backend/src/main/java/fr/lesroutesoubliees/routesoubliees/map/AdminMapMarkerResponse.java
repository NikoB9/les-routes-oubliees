package fr.lesroutesoubliees.routesoubliees.map;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

record AdminMapMarkerResponse(
	UUID id,
	String questCode,
	String title,
	BigDecimal positionX,
	BigDecimal positionY,
	MapMarkerLabelPosition labelPosition,
	int labelOffsetPx,
	boolean active,
	int displayOrder,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
