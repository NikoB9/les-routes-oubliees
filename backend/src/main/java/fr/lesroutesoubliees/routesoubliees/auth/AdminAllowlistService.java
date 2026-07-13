package fr.lesroutesoubliees.routesoubliees.auth;

import java.util.Locale;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
public class AdminAllowlistService {

	private final AdminAllowedEmailRepository repository;
	private final AuditService audit;

	AdminAllowlistService(AdminAllowedEmailRepository repository, AuditService audit) {
		this.repository = repository;
		this.audit = audit;
	}

	public Optional<String> normalizeEmail(String email) {
		if (email == null) {
			return Optional.empty();
		}

		var normalized = email.trim().toLowerCase(Locale.ROOT);
		if (normalized.isBlank()) {
			return Optional.empty();
		}

		return Optional.of(normalized);
	}

	@Transactional(readOnly = true)
	public boolean isAllowed(String email) {
		return normalizeEmail(email)
			.flatMap(repository::findByEmail)
			.map(AdminAllowedEmail::active)
			.orElse(false);
	}

	@Transactional
	public void bootstrapAdmin(String email) {
		normalizeEmail(email)
			.filter((normalized) -> repository.findByEmail(normalized).isEmpty())
			.ifPresent((normalized) -> repository.save(new AdminAllowedEmail(normalized, "Bootstrap admin")));
	}

	@Transactional(readOnly = true)
	public boolean hasActiveAdmin() {
		return repository.existsByActiveTrue();
	}

	@Transactional(readOnly = true)
	public boolean hasAnyAdmin() {
		return repository.count() > 0;
	}

	@Transactional(readOnly = true)
	public List<AdminAllowedEmailResponse> listAllowedEmails() {
		return repository.findAllByOrderByCreatedAtDesc().stream()
			.map(AdminAllowedEmailResponse::from)
			.toList();
	}

	@Transactional
	public AdminAllowedEmailResponse createAllowedEmail(AdminAllowedEmailCreateRequest request, String actorEmail) {
		var email = normalizeEmail(request.email())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email administrateur invalide."));
		if (repository.existsByEmail(email)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email administrateur existe déjà.");
		}
		var allowedEmail = repository.save(new AdminAllowedEmail(email, normalizeLabel(request.label())));
		audit.record(actorEmail, "ADMIN_ALLOWED_EMAIL_CREATED", "ADMIN_ALLOWED_EMAIL", allowedEmail.id().toString(),
			"Email administrateur ajoute");
		return AdminAllowedEmailResponse.from(allowedEmail);
	}

	@Transactional
	public AdminAllowedEmailResponse updateAllowedEmail(UUID id, AdminAllowedEmailUpdateRequest request, String actorEmail) {
		repository.lockAll();
		var allowedEmail = findAllowedEmail(id);
		if (allowedEmail.active() && !request.active() && repository.countByActiveTrue() <= 1) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Le dernier administrateur actif ne peut pas être désactivé.");
		}
		allowedEmail.update(normalizeLabel(request.label()), request.active());
		audit.record(actorEmail, "ADMIN_ALLOWED_EMAIL_UPDATED", "ADMIN_ALLOWED_EMAIL", allowedEmail.id().toString(),
			"Email administrateur mis à jour");
		return AdminAllowedEmailResponse.from(allowedEmail);
	}

	@Transactional
	public void deleteAllowedEmail(UUID id, String actorEmail) {
		repository.lockAll();
		var allowedEmail = findAllowedEmail(id);
		if (allowedEmail.active() && repository.countByActiveTrue() <= 1) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Le dernier administrateur actif ne peut pas être supprimé.");
		}
		repository.delete(allowedEmail);
		audit.record(actorEmail, "ADMIN_ALLOWED_EMAIL_DELETED", "ADMIN_ALLOWED_EMAIL", id.toString(),
			"Email administrateur supprimé");
	}

	private AdminAllowedEmail findAllowedEmail(UUID id) {
		return repository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email administrateur introuvable."));
	}

	private String normalizeLabel(String label) {
		return StringUtils.hasText(label) ? label.trim() : null;
	}
}
