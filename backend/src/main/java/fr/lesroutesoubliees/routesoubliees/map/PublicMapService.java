package fr.lesroutesoubliees.routesoubliees.map;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

@Service
public class PublicMapService {

	private final MapVisionRepository repository;
	private final MapMarkerRepository markerRepository;

	PublicMapService(MapVisionRepository repository, MapMarkerRepository markerRepository) {
		this.repository = repository;
		this.markerRepository = markerRepository;
	}

	@Transactional(readOnly = true)
	public PublicMapResponse publicMap() {
		var vision = repository.findFirstByActiveTrueAndStatus(EditorialStatus.PUBLISHED)
			.map(this::toResponse)
			.orElse(null);

		if (vision == null) {
			return new PublicMapResponse(null, List.of());
		}

		return new PublicMapResponse(vision, publicMarkers());
	}

	private PublicMapVisionResponse toResponse(MapVision vision) {
		return new PublicMapVisionResponse(
			vision.id(),
			vision.name(),
			vision.descriptionMarkdown(),
			vision.assetPath(),
			vision.imageAlt(),
			vision.displayOrder());
	}

	private List<PublicMapMarkerResponse> publicMarkers() {
		return markerRepository.findPublicMarkers()
			.stream()
			.map(marker -> new PublicMapMarkerResponse(
				marker.getId(),
				marker.getTitle(),
				marker.getPositionX(),
				marker.getPositionY(),
				marker.getDisplayOrder(),
				marker.getQuestCode()))
			.toList();
	}
}
