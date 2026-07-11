package fr.lesroutesoubliees.routesoubliees.map;

import java.util.List;

public record PublicMapResponse(
	PublicMapVisionResponse vision,
	List<PublicMapMarkerResponse> markers
) {
}
