package fr.lesroutesoubliees.routesoubliees.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class AdminOidcAuthorizationServiceTests {

	private final AdminAllowlistService allowlistService = mock(AdminAllowlistService.class);
	private final AdminOidcAuthorizationService service = new AdminOidcAuthorizationService(allowlistService);

	@Test
	void acceptsVerifiedAllowedEmail() {
		when(allowlistService.isAllowed("admin@example.com")).thenReturn(true);

		assertThatCode(() -> service.verifyAdminAccess("admin@example.com", true))
			.doesNotThrowAnyException();
	}

	@Test
	void rejectsMissingEmail() {
		assertThatThrownBy(() -> service.verifyAdminAccess(null, true))
			.isInstanceOf(AdminAccessDeniedException.class);
	}

	@Test
	void rejectsUnverifiedEmail() {
		assertThatThrownBy(() -> service.verifyAdminAccess("admin@example.com", false))
			.isInstanceOf(AdminAccessDeniedException.class);
	}

	@Test
	void rejectsEmailOutsideAllowlist() {
		when(allowlistService.isAllowed("admin@example.com")).thenReturn(false);

		assertThatThrownBy(() -> service.verifyAdminAccess("admin@example.com", true))
			.isInstanceOf(AdminAccessDeniedException.class);
	}
}
