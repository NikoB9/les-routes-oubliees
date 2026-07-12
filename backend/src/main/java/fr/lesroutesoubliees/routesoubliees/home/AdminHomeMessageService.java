package fr.lesroutesoubliees.routesoubliees.home;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;
import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

@Service
public class AdminHomeMessageService {

	private final HomeMessageRepository repository;
	private final AuditService audit;

	AdminHomeMessageService(HomeMessageRepository repository, AuditService audit) {
		this.repository = repository;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public List<AdminHomeMessageResponse> listMessages() {
		return repository.findAllByUpdatedAtDesc().stream().map(this::toResponse).toList();
	}

	@Transactional
	public AdminHomeMessageResponse createMessage(AdminHomeMessageUpsertRequest request, String actorEmail) {
		validateCountdown(request);
		var message = new HomeMessage(
			UUID.randomUUID(),
			request.title().trim(),
			request.contentMarkdown().trim(),
			request.importance(),
			request.status(),
			false,
			request.countdownEnabled(),
			request.endsAt(),
			trimToNull(request.expiredMessage()),
			actorEmail);
		repository.save(message);
		audit.record(actorEmail, "HOME_MESSAGE_CREATED", "HOME_MESSAGE", message.id().toString(), "Parchemin cree");
		return toResponse(message);
	}

	@Transactional
	public AdminHomeMessageResponse updateMessage(UUID id, AdminHomeMessageUpsertRequest request, String actorEmail) {
		validateCountdown(request);
		var message = findMessage(id);
		message.update(
			request.title().trim(),
			request.contentMarkdown().trim(),
			request.importance(),
			request.status(),
			request.countdownEnabled(),
			request.endsAt(),
			trimToNull(request.expiredMessage()),
			actorEmail);
		audit.record(actorEmail, "HOME_MESSAGE_UPDATED", "HOME_MESSAGE", message.id().toString(), "Parchemin modifie");
		return toResponse(message);
	}

	@Transactional
	public AdminHomeMessageResponse activateMessage(UUID id, String actorEmail) {
		var message = findMessage(id);
		if (message.status() != EditorialStatus.PUBLISHED) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only a published home message can be active");
		}
		repository.findByActiveTrue().forEach(HomeMessage::deactivate);
		repository.flush();
		message.activate(actorEmail);
		audit.record(actorEmail, "HOME_MESSAGE_ACTIVATED", "HOME_MESSAGE", message.id().toString(), "Parchemin active");
		return toResponse(message);
	}

	@Transactional
	public void deleteMessage(UUID id, String actorEmail) {
		var message = findMessage(id);
		if (message.active()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Active home message cannot be deleted");
		}
		repository.delete(message);
		audit.record(actorEmail, "HOME_MESSAGE_DELETED", "HOME_MESSAGE", id.toString(), "Parchemin supprime");
	}

	private HomeMessage findMessage(UUID id) {
		return repository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Home message does not exist"));
	}

	private void validateCountdown(AdminHomeMessageUpsertRequest request) {
		if (request.countdownEnabled() && request.endsAt() == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Countdown end date is required");
		}
	}

	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

	private AdminHomeMessageResponse toResponse(HomeMessage message) {
		return new AdminHomeMessageResponse(
			message.id(),
			message.title(),
			message.contentMarkdown(),
			message.importance(),
			message.status(),
			message.active(),
			message.countdownEnabled(),
			message.endsAt(),
			message.expiredMessage(),
			message.lastModifiedBy(),
			message.createdAt(),
			message.updatedAt());
	}
}
