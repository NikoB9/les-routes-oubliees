package fr.lesroutesoubliees.routesoubliees.map;

import java.util.List;

record AdminMapPreviewResponse(
	AdminMapVisionResponse vision,
	List<AdminMapMarkerResponse> markers
) {
}
