package fr.lesroutesoubliees.routesoubliees.map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

@Service
public class PublicMapService {

	private final MapVisionRepository repository;

	PublicMapService(MapVisionRepository repository) {
		this.repository = repository;
	}

	@Transactional(readOnly = true)
	public PublicMapVisionResponse activeVision() {
		return repository.findFirstByActiveTrueAndStatus(EditorialStatus.PUBLISHED)
			.map(this::toResponse)
			.orElse(null);
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
}
