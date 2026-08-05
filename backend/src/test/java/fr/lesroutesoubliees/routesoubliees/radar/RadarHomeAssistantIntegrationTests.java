package fr.lesroutesoubliees.routesoubliees.radar;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@TestPropertySource(properties = "routes-oubliees.radar.home-assistant.token=test-ha-token")
@Transactional
class RadarHomeAssistantIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
		jdbc.update("""
			update radar_state
			set treasure_visible = true, treasure_latitude = null, treasure_longitude = null,
			    treasure_accuracy_m = null, treasure_observed_at = null, treasure_received_at = null
			where id = 1
			""");
		jdbc.update("delete from portal_identities where normalized_email like 'radar-test-%@example.invalid'");
		jdbc.update("""
			insert into portal_identities(
				id, cloudflare_subject, normalized_email, access_mode, selected_at, created_at, updated_at
			)
			values (?, 'subject-radar-user', 'radar-test-user@example.invalid', 'GUEST', now(), now(), now())
			""", UUID.randomUUID());
	}

	@Test
	void acceptsValidBearerAndRejectsInvalidAuthenticationCases() throws Exception {
		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isNoContent())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

		mvc.perform(postTreasure(now()))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer "))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer wrong"))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Basic test-ha-token"))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "bEaReR test-ha-token"))
			.andExpect(status().isNoContent());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token extra"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void rejectsInvalidPayloadsAndOtherIntegrationRoutes() throws Exception {
		mvc.perform(post("/api/integrations/home-assistant/other")
				.header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token")
				.with(csrf()))
			.andExpect(status().isForbidden());

		mvc.perform(post("/api/integrations/home-assistant/radar/treasure-position")
				.header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{"))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now(), 91.0, -1.0, 5.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now(), 46.0, -181.0, 5.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now(), 46.0, -1.0, 0.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now().plusMinutes(3)).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void ignoresOlderAndSameObservedAtAndUsesObservedAtForStaleness() throws Exception {
		var first = now().minusMinutes(2);
		var older = first.minusMinutes(1);
		var staleObservedAt = now().minusMinutes(6);

		mvc.perform(postTreasure(first, 46.1, -1.1, 5.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isNoContent());
		mvc.perform(postTreasure(older, 47.0, -2.0, 6.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isNoContent());
		mvc.perform(postTreasure(first, 48.0, -3.0, 7.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isNoContent());

		mvc.perform(get("/api/radar/snapshot").with(authentication(user())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasure.latitude").value(46.1))
			.andExpect(jsonPath("$.treasure.longitude").value(-1.1))
			.andExpect(jsonPath("$.treasure.stale").value(false));

		jdbc.update("""
			update radar_state
			set treasure_latitude = null, treasure_longitude = null, treasure_accuracy_m = null,
			    treasure_observed_at = null, treasure_received_at = null
			where id = 1
			""");
		mvc.perform(postTreasure(staleObservedAt, 46.3, -1.3, 5.0).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isNoContent());
		jdbc.update("update radar_state set treasure_received_at = now() where id = 1");

		mvc.perform(get("/api/radar/snapshot").with(authentication(user())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasure.latitude").value(46.3))
			.andExpect(jsonPath("$.treasure.stale").value(true));
	}

	@Test
	void hidesTreasureCoordinatesWhenVisibilityIsDisabled() throws Exception {
		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer test-ha-token"))
			.andExpect(status().isNoContent());
		jdbc.update("update radar_state set treasure_visible = false where id = 1");

		mvc.perform(get("/api/radar/snapshot").with(authentication(user())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasure").value(nullValue()))
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
	}

	private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postTreasure(OffsetDateTime observedAt) {
		return postTreasure(observedAt, 46.495854, -1.775551, 6.414);
	}

	private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postTreasure(
		OffsetDateTime observedAt,
		double latitude,
		double longitude,
		double accuracyM
	) {
		return post("/api/integrations/home-assistant/radar/treasure-position")
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
				{
				  "schemaVersion": 1,
				  "beacon": "tresor-aurelune",
				  "latitude": %s,
				  "longitude": %s,
				  "accuracyM": %s,
				  "observedAt": "%s"
				}
				""".formatted(latitude, longitude, accuracyM, observedAt));
	}

	private OffsetDateTime now() {
		return OffsetDateTime.now(ZoneOffset.UTC).withNano(0);
	}

	private UsernamePasswordAuthenticationToken user() {
		return new UsernamePasswordAuthenticationToken(
			new CloudflareAccessPrincipal("subject-radar-user", "radar-test-user@example.invalid"),
			null,
			List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}
}
