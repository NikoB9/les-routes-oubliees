package fr.lesroutesoubliees.routesoubliees.map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/map")
class PublicMapController {

	private final PublicMapService maps;

	PublicMapController(PublicMapService maps) {
		this.maps = maps;
	}

	@GetMapping
	PublicMapResponse getMap() {
		return new PublicMapResponse(maps.activeVision());
	}
}
