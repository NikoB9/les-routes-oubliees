package fr.lesroutesoubliees.routesoubliees.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

class AdminAllowlistServiceTests {

	private final AdminAllowedEmailRepository repository = mock(AdminAllowedEmailRepository.class);
	private final AuditService audit = mock(AuditService.class);
	private final AdminAllowlistService service = new AdminAllowlistService(repository, audit);

	@Test
	void normalizeEmailTrimsAndLowercases() {
		assertThat(service.normalizeEmail("  Admin@Example.COM  ")).contains("admin@example.com");
	}

	@Test
	void normalizeEmailRejectsBlankValues() {
		assertThat(service.normalizeEmail("   ")).isEmpty();
		assertThat(service.normalizeEmail(null)).isEmpty();
	}

	@Test
	void isAllowedAcceptsActiveEmail() {
		when(repository.findByEmail("admin@example.com"))
			.thenReturn(Optional.of(new AdminAllowedEmail("admin@example.com", "Admin")));

		assertThat(service.isAllowed("ADMIN@example.com")).isTrue();
	}

	@Test
	void isAllowedRejectsUnknownEmail() {
		when(repository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

		assertThat(service.isAllowed("unknown@example.com")).isFalse();
	}

	@Test
	void bootstrapAdminIgnoresExistingEmail() {
		when(repository.findByEmail("admin@example.com"))
			.thenReturn(Optional.of(new AdminAllowedEmail("admin@example.com", "Admin")));

		service.bootstrapAdmin("admin@example.com");

		verify(repository, never()).save(any());
	}
}
