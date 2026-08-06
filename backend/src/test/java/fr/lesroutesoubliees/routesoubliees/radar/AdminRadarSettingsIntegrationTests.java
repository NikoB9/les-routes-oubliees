package fr.lesroutesoubliees.routesoubliees.radar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

/** Reglages Radar de l'administration : visibilite du tresor et trace de l'acteur. */
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class AdminRadarSettingsIntegrationTests {

	private static final String SETTINGS_PATH = "/api/admin/radar/settings";

	private static final String ADMIN_SUBJECT = "subject-radar-admin";

	/** Adresse d'amorcage du profil de test : la seule presente dans l'allowlist admin. */
	private static final String ADMIN_EMAIL = "admin@example.invalid";

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	private MockMvc mvc;
	private UUID adminIdentityId;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
		jdbc.update("""
			update radar_state
			set treasure_visible = true, treasure_visibility_updated_by = null,
			    treasure_visibility_updated_at = null
			where id = 1
			""");
		jdbc.update("delete from portal_identities where normalized_email = ?", ADMIN_EMAIL);
		adminIdentityId = UUID.randomUUID();
		jdbc.update("""
			insert into portal_identities(
				id, cloudflare_subject, normalized_email, access_mode, selected_at, created_at, updated_at
			)
			values (?, ?, ?, 'GUEST', now(), now(), now())
			""", adminIdentityId, ADMIN_SUBJECT, ADMIN_EMAIL);
	}

	@Test
	void hidesTheTreasureAndRecordsTheActingAdministrator() throws Exception {
		mvc.perform(put(SETTINGS_PATH)
				.with(authentication(admin(ADMIN_SUBJECT)))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"treasureVisible\": false}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasureVisible").value(false));

		assertThat(actorIdentityId()).isEqualTo(adminIdentityId);
	}

	/**
	 * La colonne reference {@code portal_identities} : un administrateur qui n'a jamais
	 * ouvert le portail n'a pas d'identite, et cela ne doit pas empecher l'action. La trace
	 * de reference reste {@code audit_logs}, qui enregistre l'adresse de l'acteur.
	 */
	@Test
	void stillAcceptsAnAdministratorWithoutPortalIdentity() throws Exception {
		mvc.perform(put(SETTINGS_PATH)
				.with(authentication(admin("subject-sans-identite-portail")))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"treasureVisible\": false}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasureVisible").value(false));

		assertThat(actorIdentityId()).isNull();
	}

	@Test
	void refusesANonAdministrator() throws Exception {
		mvc.perform(put(SETTINGS_PATH)
				.with(authentication(new UsernamePasswordAuthenticationToken(
					new CloudflareAccessPrincipal(ADMIN_SUBJECT, ADMIN_EMAIL),
					null,
					List.of(new SimpleGrantedAuthority("ROLE_USER")))))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"treasureVisible\": false}"))
			.andExpect(status().isForbidden());
	}

	private UUID actorIdentityId() {
		return jdbc.queryForObject(
			"select treasure_visibility_updated_by from radar_state where id = 1",
			UUID.class);
	}

	private UsernamePasswordAuthenticationToken admin(String subject) {
		return new UsernamePasswordAuthenticationToken(
			new CloudflareAccessPrincipal(subject, ADMIN_EMAIL),
			null,
			List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN")));
	}
}
