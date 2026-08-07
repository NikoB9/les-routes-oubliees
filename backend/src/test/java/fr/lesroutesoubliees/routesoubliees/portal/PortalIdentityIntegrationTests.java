package fr.lesroutesoubliees.routesoubliees.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
class PortalIdentityIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
		jdbc.update("delete from portal_identities where normalized_email like 'portal-test-%@example.invalid'");
		jdbc.update("""
			insert into admin_allowed_emails(id, email, label, active, created_at, updated_at)
			values (?, 'portal-admin@example.invalid', 'Portal test admin', true, now(), now())
			on conflict (email) do update
			set active = true, updated_at = now()
			""", UUID.randomUUID());
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from portal_identities where normalized_email like 'portal-test-%@example.invalid'");
	}

	@Test
	void assignsAdventurerOnlyOnceAndDoesNotExposeEmailPublicly() throws Exception {
		var adventurerId = visibleAdventurerId();
		var first = portalUser("subject-portal-1", "portal-test-1@example.invalid");
		var second = portalUser("subject-portal-2", "portal-test-2@example.invalid");

		mvc.perform(post("/api/portal/me/adventurer")
				.with(authentication(first))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"adventurerId\":\"%s\"}".formatted(adventurerId)))
			.andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
			.andExpect(jsonPath("$.identity.accessMode").value("ADVENTURER"))
			.andExpect(jsonPath("$.identity.email").doesNotExist());

		mvc.perform(post("/api/portal/me/adventurer")
				.with(authentication(second))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"adventurerId\":\"%s\"}".formatted(adventurerId)))
			.andExpect(status().isConflict());

		mvc.perform(post("/api/portal/me/adventurer")
				.with(authentication(first))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"adventurerId\":\"%s\"}".formatted(otherVisibleAdventurerId(adventurerId))))
			.andExpect(status().isConflict());
	}

	@Test
	void refusesGuestModeWhileAdventurerIsAvailable() throws Exception {
		mvc.perform(get("/api/portal/me").with(authentication(portalUser("subject-portal-3", "portal-test-3@example.invalid"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.availableAdventurers", not(empty())))
			.andExpect(jsonPath("$.guestAvailable").value(false))
			.andExpect(jsonPath("$.canAccessAdmin").value(false))
			.andExpect(jsonPath("$.identity.email").doesNotExist());

		mvc.perform(post("/api/portal/me/guest")
				.with(authentication(portalUser("subject-portal-3", "portal-test-3@example.invalid")))
				.with(csrf()))
			.andExpect(status().isConflict());
	}

	@Test
	void adminRoleIsExposedWithoutEmailInPortalMe() throws Exception {
		mvc.perform(get("/api/portal/me")
				.with(authentication(portalAdmin("subject-portal-admin", "portal-test-admin@example.invalid"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.canAccessAdmin").value(true))
			.andExpect(jsonPath("$.identity.email").doesNotExist());
	}

	@Test
	void adminCanCorrectAndReleaseAssignmentsAndSeesEmailOnlyThere() throws Exception {
		var adventurerId = visibleAdventurerId();
		var user = portalUser("subject-portal-4", "portal-test-4@example.invalid");
		mvc.perform(get("/api/portal/me").with(authentication(user))).andExpect(status().isOk());
		var identityId = jdbc.queryForObject(
			"select id from portal_identities where normalized_email = 'portal-test-4@example.invalid'",
			UUID.class);

		mvc.perform(put("/api/admin/portal-identities/" + identityId + "/assignment")
				.with(user("portal-admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"accessMode\":\"ADVENTURER\",\"adventurerId\":\"%s\"}".formatted(adventurerId)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.normalizedEmail").value("portal-test-4@example.invalid"));

		mvc.perform(put("/api/admin/portal-identities/" + identityId + "/assignment")
				.with(user("portal-admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"accessMode\":\"GUEST\",\"adventurerId\":null}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessMode").value("GUEST"));

		mvc.perform(put("/api/admin/portal-identities/" + identityId + "/assignment")
				.with(user("portal-admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"accessMode\":\"UNASSIGNED\",\"adventurerId\":null}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessMode").value("UNASSIGNED"))
			.andExpect(jsonPath("$.adventurerId").doesNotExist());
	}

	/**
	 * Cloudflare Access emet un sujet par identite de fournisseur, pas par personne : la meme
	 * adresse revient avec un sujet different des que le joueur change de methode de connexion.
	 * Sans reassociation, l'insertion violait l'unicite de l'adresse et le joueur restait
	 * bloque hors du portail, sans recours administrable.
	 */
	@Test
	void rebindsTheIdentityWhenCloudflareIssuesANewSubjectForTheSameEmail() throws Exception {
		var email = "portal-test-5@example.invalid";
		mvc.perform(get("/api/portal/me").with(authentication(portalUser("subject-portal-5a", email))))
			.andExpect(status().isOk());
		var identityId = identityId(email);

		mvc.perform(get("/api/portal/me").with(authentication(portalUser("subject-portal-5b", email))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.identity.id").value(identityId.toString()));

		assertThat(jdbc.queryForObject(
			"select cloudflare_subject from portal_identities where id = ?", String.class, identityId))
			.as("le sujet doit avoir ete reassocie a l'identite existante")
			.isEqualTo("subject-portal-5b");
		assertThat(jdbc.queryForObject(
			"select count(*) from portal_identities where normalized_email = ?", Long.class, email))
			.as("une adresse ne doit jamais porter deux identites")
			.isEqualTo(1L);
	}

	/** La garantie que voit reellement le joueur : son personnage survit au changement de sujet. */
	@Test
	void keepsTheChosenAdventurerAcrossASubjectChange() throws Exception {
		var email = "portal-test-6@example.invalid";
		var adventurerId = visibleAdventurerId();
		mvc.perform(post("/api/portal/me/adventurer")
				.with(authentication(portalUser("subject-portal-6a", email)))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"adventurerId\":\"%s\"}".formatted(adventurerId)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.identity.accessMode").value("ADVENTURER"));

		mvc.perform(get("/api/portal/me").with(authentication(portalUser("subject-portal-6b", email))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.identity.accessMode").value("ADVENTURER"))
			.andExpect(jsonPath("$.identity.adventurerId").value(adventurerId.toString()));
	}

	private UUID identityId(String email) {
		return jdbc.queryForObject("select id from portal_identities where normalized_email = ?", UUID.class, email);
	}

	private UUID visibleAdventurerId() {
		return jdbc.queryForObject("select id from adventurers where visible = true order by display_order limit 1", UUID.class);
	}

	private UUID otherVisibleAdventurerId(UUID excludedId) {
		return jdbc.queryForObject(
			"select id from adventurers where visible = true and id <> ? order by display_order limit 1",
			UUID.class,
			excludedId);
	}

	private UsernamePasswordAuthenticationToken portalUser(String subject, String email) {
		return new UsernamePasswordAuthenticationToken(
			new CloudflareAccessPrincipal(subject, email),
			null,
			List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	private UsernamePasswordAuthenticationToken portalAdmin(String subject, String email) {
		return new UsernamePasswordAuthenticationToken(
			new CloudflareAccessPrincipal(subject, email),
			null,
			List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN")));
	}

}
