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

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class RadarHomeAssistantIntegrationTests {

	/** Valeur injectee par {@code application-test.yml}, sans rapport avec un secret reel. */
	private static final String TEST_TOKEN = "integration-test-home-assistant-bearer-0123456789abcdef";

	private static final String BEARER = "Bearer " + TEST_TOKEN;

	private static final String TREASURE_PATH = "/api/integrations/home-assistant/radar/treasure-position";

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
		// Chaque releve accepte porte un horodatage strictement croissant : deux mesures de
		// meme horodatage seraient ignorees, ce que couvre un test dedie.
		var firstObservedAt = now().minusMinutes(5);

		mvc.perform(postTreasure(firstObservedAt).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isNoContent())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

		mvc.perform(postTreasure(now()))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
			.andExpect(header().string("X-LRO-Auth-Error", "application"));

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer "))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Bearer wrong"))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, "Basic " + TEST_TOKEN))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(firstObservedAt.plusSeconds(1)).header(HttpHeaders.AUTHORIZATION, "bEaReR " + TEST_TOKEN))
			.andExpect(status().isNoContent());

		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, BEARER + " extra"))
			.andExpect(status().isUnauthorized());

		mvc.perform(postTreasure(now())
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void closesNeighbouringIntegrationPathsAndMethods() throws Exception {
		mvc.perform(post("/api/integrations/home-assistant/other")
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.with(csrf()))
			.andExpect(status().isUnauthorized());

		mvc.perform(get(TREASURE_PATH).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isUnauthorized());

		mvc.perform(put(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.with(csrf()))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void rejectsMalformedEmptyIncompleteAndUnknownPayloadFields() throws Exception {
		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{"))
			.andExpect(status().isBadRequest());

		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content(""))
			.andExpect(status().isBadRequest());

		// Champ obligatoire absent.
		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "schemaVersion": 1,
					  "beacon": "tresor-aurelune",
					  "longitude": -1.0,
					  "accuracyM": 5.0,
					  "observedAt": "%s"
					}
					""".formatted(now())))
			.andExpect(status().isBadRequest());

		// Type incorrect.
		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "schemaVersion": 1,
					  "beacon": "tresor-aurelune",
					  "latitude": "quarante-six",
					  "longitude": -1.0,
					  "accuracyM": 5.0,
					  "observedAt": "%s"
					}
					""".formatted(now())))
			.andExpect(status().isBadRequest());

		// Propriete inconnue : la stricte lecture ne doit pas dependre du defaut global.
		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "schemaVersion": 1,
					  "beacon": "tresor-aurelune",
					  "latitude": 46.0,
					  "longitude": -1.0,
					  "accuracyM": 5.0,
					  "observedAt": "%s",
					  "googleAccount": "leak@example.invalid"
					}
					""".formatted(now())))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now(), 91.0, -1.0, 5.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now(), 46.0, -181.0, 5.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now(), 46.0, -1.0, 0.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isBadRequest());

		mvc.perform(postTreasure(now().plusMinutes(3)).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isBadRequest());
	}

	@Test
	void rejectsBodiesLargerThanFourKibibytes() throws Exception {
		var oversized = new byte[4097];
		Arrays.fill(oversized, (byte) 'x');

		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content(oversized))
			.andExpect(status().isPayloadTooLarge());
	}

	@Test
	void acceptsBodyExactlyAtFourKibibytes() throws Exception {
		var payload = """
			{
			  "schemaVersion": 1,
			  "beacon": "tresor-aurelune",
			  "latitude": 46.0,
			  "longitude": -1.0,
			  "accuracyM": 5.0,
			  "observedAt": "%s"
			}
			""".formatted(now());
		// Complete par des espaces, insignifiants en JSON, jusqu'a la limite exacte.
		var padded = payload + " ".repeat(4096 - payload.getBytes(StandardCharsets.UTF_8).length);

		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content(padded.getBytes(StandardCharsets.UTF_8)))
			.andExpect(status().isNoContent());
	}

	@Test
	void distinguishesAppliedMeasureFromIgnoredMeasure() throws Exception {
		var first = now().minusMinutes(2);
		var older = first.minusMinutes(1);

		mvc.perform(postTreasure(first, 46.1, -1.1, 5.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isNoContent());

		// Mesure plus ancienne : ignoree, sans exposer la position enregistree.
		mvc.perform(postTreasure(older, 47.0, -2.0, 6.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
			.andExpect(jsonPath("$.status").value("ignored"))
			.andExpect(jsonPath("$.latitude").doesNotExist())
			.andExpect(jsonPath("$.longitude").doesNotExist());

		// Meme horodatage : ignoree egalement.
		mvc.perform(postTreasure(first, 48.0, -3.0, 7.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ignored"));

		// Mesure strictement plus recente : appliquee.
		mvc.perform(postTreasure(first.plusSeconds(1), 46.2, -1.2, 5.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isNoContent());

		mvc.perform(get("/api/radar/snapshot").with(authentication(user())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasure.latitude").value(46.2))
			.andExpect(jsonPath("$.treasure.longitude").value(-1.2))
			.andExpect(jsonPath("$.treasure.stale").value(false));
	}

	@Test
	void usesObservedAtForStaleness() throws Exception {
		var staleObservedAt = now().minusMinutes(6);

		mvc.perform(postTreasure(staleObservedAt, 46.3, -1.3, 5.0).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isNoContent());
		jdbc.update("update radar_state set treasure_received_at = now() where id = 1");

		mvc.perform(get("/api/radar/snapshot").with(authentication(user())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasure.latitude").value(46.3))
			.andExpect(jsonPath("$.treasure.stale").value(true));
	}

	@Test
	void hidesTreasureCoordinatesWhenVisibilityIsDisabled() throws Exception {
		mvc.perform(postTreasure(now()).header(HttpHeaders.AUTHORIZATION, BEARER))
			.andExpect(status().isNoContent());
		jdbc.update("update radar_state set treasure_visible = false where id = 1");

		mvc.perform(get("/api/radar/snapshot").with(authentication(user())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.treasure").value(nullValue()))
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
	}

	private MockHttpServletRequestBuilder postTreasure(OffsetDateTime observedAt) {
		return postTreasure(observedAt, 46.495854, -1.775551, 6.414);
	}

	private MockHttpServletRequestBuilder postTreasure(
		OffsetDateTime observedAt,
		double latitude,
		double longitude,
		double accuracyM
	) {
		return post(TREASURE_PATH)
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
