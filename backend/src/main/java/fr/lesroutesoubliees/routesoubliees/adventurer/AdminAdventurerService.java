package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
public class AdminAdventurerService {

	private final AdventurerRepository repository;
	private final AuditService audit;

	AdminAdventurerService(AdventurerRepository repository, AuditService audit) {
		this.repository = repository;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public List<AdminAdventurerResponse> listAdventurers() {
		return repository.findAllByOrderByDisplayOrderAsc().stream().map(this::toResponse).toList();
	}

	@Transactional
	public AdminAdventurerResponse createAdventurer(AdminAdventurerUpsertRequest request, String actorEmail) {
		var adventurer = new Adventurer(
			UUID.randomUUID(),
			request.name().trim(),
			request.title().trim(),
			trimToNull(request.avatarPath()),
			trimToNull(request.avatarAlt()),
			request.shortDescription().trim(),
			request.strengths().trim(),
			request.weaknesses().trim(),
			request.visible(),
			repository.maxDisplayOrder() + 1);
		repository.save(adventurer);
		audit.record(actorEmail, "ADVENTURER_CREATED", "ADVENTURER", adventurer.id().toString(), "Aventurier cree");
		return toResponse(adventurer);
	}

	@Transactional
	public AdminAdventurerResponse updateAdventurer(UUID id, AdminAdventurerUpsertRequest request, String actorEmail) {
		var adventurer = findAdventurer(id);
		adventurer.update(
			request.name().trim(),
			request.title().trim(),
			trimToNull(request.avatarPath()),
			trimToNull(request.avatarAlt()),
			request.shortDescription().trim(),
			request.strengths().trim(),
			request.weaknesses().trim(),
			request.visible(),
			adventurer.displayOrder());
		audit.record(actorEmail, "ADVENTURER_UPDATED", "ADVENTURER", adventurer.id().toString(), "Aventurier modifie");
		return toResponse(adventurer);
	}

	@Transactional
	public List<AdminAdventurerResponse> reorderAdventurers(AdminAdventurerReorderRequest request, String actorEmail) {
		var adventurers = repository.findAllByOrderByDisplayOrderAsc();
		var knownIds = adventurers.stream().map(Adventurer::id).toList();
		if (request.orderedIds().size() != knownIds.size() || !new HashSet<>(request.orderedIds()).containsAll(knownIds)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reorder payload must contain every adventurer");
		}
		for (int index = 0; index < request.orderedIds().size(); index++) {
			findIn(adventurers, request.orderedIds().get(index)).changeDisplayOrder(-(index + 1));
		}
		repository.flush();
		for (int index = 0; index < request.orderedIds().size(); index++) {
			findIn(adventurers, request.orderedIds().get(index)).changeDisplayOrder(index + 1);
		}
		audit.record(actorEmail, "ADVENTURERS_REORDERED", "ADVENTURER", null, "Aventuriers reordonnes");
		return adventurers.stream()
			.sorted(java.util.Comparator.comparingInt(Adventurer::displayOrder))
			.map(this::toResponse)
			.toList();
	}

	@Transactional
	public void deleteAdventurer(UUID id, String actorEmail) {
		var adventurer = findAdventurer(id);
		repository.delete(adventurer);
		audit.record(actorEmail, "ADVENTURER_DELETED", "ADVENTURER", id.toString(), "Aventurier supprime");
	}

	private Adventurer findAdventurer(UUID id) {
		return repository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Adventurer does not exist"));
	}

	private Adventurer findIn(List<Adventurer> adventurers, UUID id) {
		return adventurers.stream()
			.filter(adventurer -> adventurer.id().equals(id))
			.findFirst()
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown adventurer"));
	}

	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

	private AdminAdventurerResponse toResponse(Adventurer adventurer) {
		return new AdminAdventurerResponse(
			adventurer.id(),
			adventurer.name(),
			adventurer.title(),
			adventurer.avatarPath(),
			adventurer.avatarAlt(),
			adventurer.shortDescription(),
			adventurer.strengths(),
			adventurer.weaknesses(),
			adventurer.visible(),
			adventurer.displayOrder(),
			adventurer.createdAt(),
			adventurer.updatedAt());
	}
}
