package fr.lesroutesoubliees.routesoubliees.portal;

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
			.andExpect(jsonPath("$.guestAvailable").value(false));

		mvc.perform(post("/api/portal/me/guest")
				.with(authentication(portalUser("subject-portal-3", "portal-test-3@example.invalid")))
				.with(csrf()))
			.andExpect(status().isConflict());
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

}
