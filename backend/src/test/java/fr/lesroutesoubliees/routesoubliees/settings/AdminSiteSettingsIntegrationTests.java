package fr.lesroutesoubliees.routesoubliees.settings;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class AdminSiteSettingsIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void exposesPublicSettingsWithoutAdminMetadata() throws Exception {
		mvc.perform(get("/api/public/settings"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.siteName").value("Les Routes Oubliées"))
			.andExpect(jsonPath("$.timezone").value("Europe/Paris"))
			.andExpect(jsonPath("$.status").value("ONLINE"))
			.andExpect(jsonPath("$.updatedBy").doesNotExist())
			.andExpect(jsonPath("$.createdAt").doesNotExist());
	}

	@Test
	void requiresAuthenticationForAdminSettings() throws Exception {
		mvc.perform(get("/api/admin/settings"))
			.andExpect(status().isForbidden());
	}

	@Test
	void updatesSettingsAndPublishesMaintenanceState() throws Exception {
		mvc.perform(put("/api/admin/settings")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "siteName": "Les Routes de Test",
					  "subtitle": "Compagnie de validation",
					  "logoPath": "/assets/brand/test-logo.webp",
					  "timezone": "UTC",
					  "status": "MAINTENANCE",
					  "maintenanceMessage": "Maintenance courte en cours.",
					  "accessibilityInformationMarkdown": "Page d'accessibilité en préparation."
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.siteName").value("Les Routes de Test"))
			.andExpect(jsonPath("$.timezone").value("UTC"))
			.andExpect(jsonPath("$.updatedBy").value("admin@example.invalid"));

		mvc.perform(get("/api/public/settings"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.siteName").value("Les Routes de Test"))
			.andExpect(jsonPath("$.status").value("MAINTENANCE"))
			.andExpect(jsonPath("$.maintenanceMessage").value("Maintenance courte en cours."))
			.andExpect(jsonPath("$.updatedBy").doesNotExist());

		mvc.perform(get("/api/admin/audit-logs").with(user("admin@example.invalid")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].action", hasItem("SITE_SETTINGS_UPDATED")));
	}

	@Test
	void rejectsInvalidSettingsValues() throws Exception {
		mvc.perform(put("/api/admin/settings")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "siteName": "Les Routes",
					  "subtitle": null,
					  "logoPath": "https://example.invalid/logo.png",
					  "timezone": "Not/A_Timezone",
					  "status": "MAINTENANCE",
					  "maintenanceMessage": null,
					  "accessibilityInformationMarkdown": "Informations."
					}
					"""))
			.andExpect(status().isBadRequest());
	}
}
