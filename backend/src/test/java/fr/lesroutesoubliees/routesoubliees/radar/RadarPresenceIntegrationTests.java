package fr.lesroutesoubliees.routesoubliees.radar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

/**
 * Cycle de vie des presences Radar cote serveur.
 *
 * <p>L'expiration est verifiee avec une horloge simulee : aucune attente reelle de 45
 * secondes n'est necessaire.
 *
 * <p>Volontairement sans {@code @Transactional} de classe : les diffusions SSE sont
 * reportees apres le commit, donc un test enveloppe dans une transaction annulee n'en
 * verrait aucune. Les donnees de test sont nettoyees explicitement.
 */
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
class RadarPresenceIntegrationTests {

	private static final MutableClock CLOCK = new MutableClock(Instant.parse("2026-08-06T10:00:00Z"));

	private static final int TTL_MARGIN_SECONDS = 46;

	@TestConfiguration(proxyBeanMethods = false)
	static class RadarPresenceTestConfiguration {

		@Bean
		@Primary
		Clock testClock() {
			return CLOCK;
		}

		@Bean
		@Primary
		RecordingBroadcaster recordingBroadcaster() {
			return new RecordingBroadcaster();
		}
	}

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private RecordingBroadcaster broadcaster;

	@Autowired
	private RadarHeartbeat heartbeat;

	@Autowired
	private RadarService radar;

	@Autowired
	private RadarPresenceRegistry presence;

	@Autowired
	private TransactionTemplate transactions;

	private MockMvc mvc;
	private UUID firstIdentityId;
	private UUID secondIdentityId;

	private static final Instant BASE_INSTANT = Instant.parse("2026-08-06T10:00:00Z");

	@BeforeEach
	void setUp() {
		// Le registre de presences est en memoire : un saut d'horloge au-dela du TTL le vide
		// et purge les departs memorises avant chaque test.
		CLOCK.set(BASE_INSTANT.plus(Duration.ofDays(1)));
		presence.pruneExpired();
		CLOCK.set(BASE_INSTANT);
		broadcaster.clear();
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
		jdbc.update("delete from portal_identities where normalized_email like 'presence-test-%@example.invalid'");
		firstIdentityId = insertIdentity("subject-presence-1", "presence-test-1@example.invalid");
		secondIdentityId = insertIdentity("subject-presence-2", "presence-test-2@example.invalid");
	}

	@AfterEach
	void tearDown() {
		jdbc.update("delete from portal_identities where normalized_email like 'presence-test-%@example.invalid'");
	}

	@Test
	void removesOnlyTheAuthenticatedParticipant() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		publish(secondUser(), 46.2, -1.2);

		mvc.perform(delete("/api/radar/me/location").with(authentication(firstUser())).with(csrf()))
			.andExpect(status().isNoContent())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(1)))
			.andExpect(jsonPath("$.participants[0].identityId").value(secondIdentityId.toString()));
	}

	@Test
	void departureIsIdempotent() throws Exception {
		publish(firstUser(), 46.1, -1.1);

		mvc.perform(delete("/api/radar/me/location").with(authentication(firstUser())).with(csrf()))
			.andExpect(status().isNoContent());
		mvc.perform(delete("/api/radar/me/location").with(authentication(firstUser())).with(csrf()))
			.andExpect(status().isNoContent());

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(0)));
	}

	@Test
	void departureBroadcastsDisappearance() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		broadcaster.clear();

		mvc.perform(delete("/api/radar/me/location").with(authentication(firstUser())).with(csrf()))
			.andExpect(status().isNoContent());

		assertThat(broadcaster.broadcastEvents()).contains("snapshot");
	}

	@Test
	void presenceWithoutHeartbeatExpiresWithoutAnyNewPublication() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		broadcaster.clear();

		CLOCK.advance(Duration.ofSeconds(TTL_MARGIN_SECONDS));
		var removed = radar.sweepExpiredPresences();

		assertThat(removed).isEqualTo(1);
		assertThat(broadcaster.broadcastEvents()).contains("snapshot");
		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(0)));
	}

	@Test
	void regularlyRenewedPresenceNeverDisappears() throws Exception {
		publish(firstUser(), 46.1, -1.1);

		for (var beat = 0; beat < 12; beat++) {
			CLOCK.advance(Duration.ofSeconds(7));
			publish(firstUser(), 46.1, -1.1);
			heartbeat.sweepExpiredPresences();
		}

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(1)))
			.andExpect(jsonPath("$.participants[0].identityId").value(firstIdentityId.toString()));
	}

	@Test
	void sweepDoesNotBroadcastWhenNothingExpires() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		broadcaster.clear();

		CLOCK.advance(Duration.ofSeconds(10));
		heartbeat.sweepExpiredPresences();

		assertThat(broadcaster.broadcastEvents()).isEmpty();
	}

	@Test
	void scheduledSweepRemovesExpiredPresenceAndBroadcasts() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		broadcaster.clear();

		CLOCK.advance(Duration.ofSeconds(TTL_MARGIN_SECONDS));
		heartbeat.sweepExpiredPresences();

		assertThat(broadcaster.broadcastEvents()).contains("snapshot");
	}

	@Test
	void refusesDepartureWithoutCloudflareIdentity() throws Exception {
		mvc.perform(delete("/api/radar/me/location").with(csrf()))
			.andExpect(status().isUnauthorized());
	}

	/**
	 * Contrat d'erreur unique : un refus metier doit parvenir au client avec son motif, en
	 * {@code application/problem+json}, et non sous la forme d'un corps d'erreur generique
	 * dont le motif serait perdu.
	 */
	@Test
	void businessRefusalIsRenderedAsProblemJson() throws Exception {
		var future = OffsetDateTime.now(CLOCK).plusMinutes(10).withNano(0);

		mvc.perform(put("/api/radar/me/location")
				.with(authentication(firstUser()))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "latitude": 46.1,
					  "longitude": -1.1,
					  "accuracyM": 6.0,
					  "observedAt": "%s"
					}
					""".formatted(future)))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(400))
			.andExpect(jsonPath("$.detail").value("Horodatage futur invalide."));
	}

	/**
	 * Une lecture ne doit pas consommer une expiration : sinon le balayage suivant ne
	 * trouverait plus rien a retirer et ne diffuserait aucune disparition, laissant les
	 * clients deja connectes avec un ancien repere.
	 */
	@Test
	void snapshotNeverConsumesAnExpirationBeforeTheSweep() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		CLOCK.advance(Duration.ofSeconds(TTL_MARGIN_SECONDS));
		broadcaster.clear();

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(0)));

		assertThat(broadcaster.broadcastEvents()).isEmpty();

		var removed = radar.sweepExpiredPresences();

		assertThat(removed).isEqualTo(1);
		assertThat(broadcaster.broadcastEvents()).contains("snapshot");
	}

	/**
	 * Le client annule son {@code PUT} avant d'envoyer le {@code DELETE}, mais le serveur
	 * peut avoir deja commence a traiter la publication : elle ne doit pas recreer le
	 * repere.
	 */
	@Test
	void inFlightPublicationAfterDepartureNeverResurrectsTheMarker() throws Exception {
		publish(firstUser(), 46.1, -1.1);

		mvc.perform(delete("/api/radar/me/location").with(authentication(firstUser())).with(csrf()))
			.andExpect(status().isNoContent());
		broadcaster.clear();

		// Publication en vol qui atteint le serveur juste apres le depart.
		publish(firstUser(), 46.1, -1.1);

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(0)));
		assertThat(broadcaster.broadcastEvents()).isEmpty();
	}

	@Test
	void presenceReappearsAfterTheDepartureGraceWindow() throws Exception {
		publish(firstUser(), 46.1, -1.1);
		mvc.perform(delete("/api/radar/me/location").with(authentication(firstUser())).with(csrf()))
			.andExpect(status().isNoContent());

		CLOCK.advance(Duration.ofSeconds(6));
		publish(firstUser(), 46.4, -1.4);

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(1)))
			.andExpect(jsonPath("$.participants[0].latitude").value(46.4));
	}

	@Test
	void olderObservedAtNeverRewindsThePosition() throws Exception {
		var current = OffsetDateTime.now(CLOCK).withNano(0);
		publishAt(firstUser(), 46.5, -1.5, current);

		publishAt(firstUser(), 40.0, -2.0, current.minusSeconds(30));

		mvc.perform(get("/api/radar/snapshot").with(authentication(secondUser())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.participants", Matchers.hasSize(1)))
			.andExpect(jsonPath("$.participants[0].latitude").value(46.5));
	}

	/**
	 * Une diffusion construite a partir de donnees non validees ne doit jamais atteindre les
	 * abonnes : la publication est reportee apres le commit.
	 */
	@Test
	void rolledBackPublicationIsNeverBroadcast() {
		broadcaster.clear();

		transactions.execute((transactionStatus) -> {
			radar.updateMyLocation(
				new CloudflareAccessPrincipal("subject-presence-1", "presence-test-1@example.invalid"),
				new RadarLocationRequest(46.9, -1.9, 6.0, OffsetDateTime.now(CLOCK).withNano(0)));
			transactionStatus.setRollbackOnly();
			return null;
		});

		assertThat(broadcaster.broadcastEvents()).isEmpty();
	}

	private void publish(UsernamePasswordAuthenticationToken user, double latitude, double longitude)
		throws Exception {
		publishAt(user, latitude, longitude, OffsetDateTime.now(CLOCK).withNano(0));
	}

	private void publishAt(
		UsernamePasswordAuthenticationToken user,
		double latitude,
		double longitude,
		OffsetDateTime observedAt
	) throws Exception {
		mvc.perform(put("/api/radar/me/location")
				.with(authentication(user))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "latitude": %s,
					  "longitude": %s,
					  "accuracyM": 6.0,
					  "observedAt": "%s"
					}
					""".formatted(latitude, longitude, observedAt)))
			.andExpect(status().isNoContent());
	}

	private UUID insertIdentity(String subject, String email) {
		var id = UUID.randomUUID();
		jdbc.update("""
			insert into portal_identities(
				id, cloudflare_subject, normalized_email, access_mode, selected_at, created_at, updated_at
			)
			values (?, ?, ?, 'GUEST', now(), now(), now())
			""", id, subject, email);
		return id;
	}

	private UsernamePasswordAuthenticationToken firstUser() {
		return user("subject-presence-1", "presence-test-1@example.invalid");
	}

	private UsernamePasswordAuthenticationToken secondUser() {
		return user("subject-presence-2", "presence-test-2@example.invalid");
	}

	private UsernamePasswordAuthenticationToken user(String subject, String email) {
		return new UsernamePasswordAuthenticationToken(
			new CloudflareAccessPrincipal(subject, email),
			null,
			List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	/** Diffuseur enregistrant les evenements au lieu de les ecrire dans un flux SSE. */
	static class RecordingBroadcaster extends RadarEventBroadcaster {

		private final List<String> events = new ArrayList<>();

		/** L'enregistrement est synchrone : aucun flux n'est ouvert, donc aucun ecrivain. */
		@Override
		void broadcast(String name, Object data) {
			events.add(name);
		}

		List<String> broadcastEvents() {
			return List.copyOf(events);
		}

		void clear() {
			events.clear();
		}
	}

	/** Horloge simulee : evite toute attente reelle liee au TTL de 45 secondes. */
	static final class MutableClock extends Clock {

		private volatile Instant instant;

		private MutableClock(Instant instant) {
			this.instant = instant;
		}

		void set(Instant value) {
			this.instant = value;
		}

		void advance(Duration duration) {
			this.instant = this.instant.plus(duration);
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return this.instant;
		}
	}
}
