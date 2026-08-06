package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

/**
 * Verifie le comportement du profil de developpement.
 *
 * <p>Sans Cloudflare Access devant un poste local, une identite factice est injectee pour
 * que le site reste utilisable. Cette identite ne doit jamais ouvrir le chemin Home
 * Assistant, qui conserve son Bearer applicatif.
 */
@Import(TestcontainersConfiguration.class)
@ActiveProfiles({ "test", "dev" })
@SpringBootTest
@Transactional
class DevelopmentIdentityFilterTests {

	private static final String TREASURE_PATH = "/api/integrations/home-assistant/radar/treasure-position";

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private org.springframework.jdbc.core.JdbcTemplate jdbc;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void grantsALocalIdentityToHumanApisWithoutCloudflare() throws Exception {
		mvc.perform(get("/api/portal/me"))
			.andExpect(status().isOk());
		mvc.perform(get("/api/public/home"))
			.andExpect(status().isOk());
	}

	@Test
	void neverGrantsTheHomeAssistantPathWithoutItsBearer() throws Exception {
		mvc.perform(post(TREASURE_PATH)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "schemaVersion": 1,
					  "beacon": "tresor-aurelune",
					  "latitude": 46.0,
					  "longitude": -1.0,
					  "accuracyM": 5.0,
					  "observedAt": "%s"
					}
					""".formatted(java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC).withNano(0))))
			.andExpect(status().isUnauthorized());
	}

	/**
	 * L'identite locale reprend la premiere adresse d'amorcage administrateur, sinon
	 * l'administration serait inaccessible en developpement.
	 */
	@Test
	void grantsAdministrationWhenTheLocalIdentityIsAllowlisted() throws Exception {
		mvc.perform(get("/api/admin/settings"))
			.andExpect(status().isOk());
	}

	/** C'est bien l'allowlist qui decide : le filtre n'accorde jamais le role par lui-meme. */
	@Test
	void keepsAdministrationClosedWhenTheLocalIdentityIsNotAllowlisted() throws Exception {
		jdbc.update("update admin_allowed_emails set active = false");

		mvc.perform(get("/api/admin/settings"))
			.andExpect(status().isForbidden());
	}
}
