package fr.lesroutesoubliees.routesoubliees.auth;

import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAllowlistService {

	private final AdminAllowedEmailRepository repository;

	AdminAllowlistService(AdminAllowedEmailRepository repository) {
		this.repository = repository;
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
}
