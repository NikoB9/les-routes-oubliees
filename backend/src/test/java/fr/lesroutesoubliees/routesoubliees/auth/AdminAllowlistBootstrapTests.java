package fr.lesroutesoubliees.routesoubliees.auth;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

class AdminAllowlistBootstrapTests {

	private final AdminAllowlistService allowlistService = mock(AdminAllowlistService.class);

	@Test
	void importsBootstrapEmailsWhenNoActiveAdminExists() {
		when(allowlistService.hasActiveAdmin()).thenReturn(false);
		var properties = new SiteProperties("./media", "http://localhost:4200", "Europe/Paris",
			List.of("admin@example.com", "second@example.com"));
		var bootstrap = new AdminAllowlistBootstrap(properties, allowlistService);

		bootstrap.run(null);

		verify(allowlistService).bootstrapAdmin("admin@example.com");
		verify(allowlistService).bootstrapAdmin("second@example.com");
	}

	@Test
	void doesNotImportBootstrapEmailsWhenActiveAdminExists() {
		when(allowlistService.hasActiveAdmin()).thenReturn(true);
		var properties = new SiteProperties("./media", "http://localhost:4200", "Europe/Paris",
			List.of("admin@example.com"));
		var bootstrap = new AdminAllowlistBootstrap(properties, allowlistService);

		bootstrap.run(null);

		verify(allowlistService, never()).bootstrapAdmin("admin@example.com");
	}
}
