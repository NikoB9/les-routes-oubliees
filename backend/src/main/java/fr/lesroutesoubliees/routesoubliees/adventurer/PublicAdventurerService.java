package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicAdventurerService {

	private final AdventurerRepository repository;

	PublicAdventurerService(AdventurerRepository repository) {
		this.repository = repository;
	}

	@Transactional(readOnly = true)
	public List<PublicAdventurerResponse> visibleAdventurers() {
		return repository.findByVisibleTrueOrderByDisplayOrderAsc()
			.stream()
			.map(this::toResponse)
			.toList();
	}

	private PublicAdventurerResponse toResponse(Adventurer adventurer) {
		return new PublicAdventurerResponse(
			adventurer.id(),
			adventurer.name(),
			adventurer.title(),
			adventurer.avatarPath(),
			adventurer.avatarAlt(),
			adventurer.shortDescription(),
			adventurer.strengths(),
			adventurer.weaknesses(),
			adventurer.displayOrder());
	}
}
