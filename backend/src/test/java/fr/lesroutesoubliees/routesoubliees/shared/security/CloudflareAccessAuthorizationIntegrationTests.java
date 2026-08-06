package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;

/**
 * Verifie que toutes les API humaines exigent un JWT Cloudflare Access reellement valide.
 *
 * <p>Les jetons sont signes par une paire de cles locale et verifies via un JWKS servi par
 * un serveur HTTP local : ces tests couvrent le filtre et le decodeur, contrairement aux
 * tests qui injectent directement une autorite.
 */
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class CloudflareAccessAuthorizationIntegrationTests {

	private static final String ISSUER = "https://team-test.cloudflareaccess.com";
	private static final String AUDIENCE = "human-audience-tag";
	private static final String ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
	private static final String TREASURE_PATH = "/api/integrations/home-assistant/radar/treasure-position";
	private static final String HOME_ASSISTANT_BEARER =
		"Bearer integration-test-home-assistant-bearer-0123456789abcdef";
	private static final String ADMIN_EMAIL = "eclaireur-jwt@example.invalid";
	private static final String USER_EMAIL = "aventurier-jwt@example.invalid";

	private static final HttpServer JWKS_SERVER;
	private static final RSAPrivateKey SIGNING_KEY;
	private static final RSAPrivateKey UNTRUSTED_KEY;
	private static final String JWKS_URL;

	static {
		try {
			var generator = KeyPairGenerator.getInstance("RSA");
			generator.initialize(2048);
			var trusted = generator.generateKeyPair();
			var untrusted = generator.generateKeyPair();
			SIGNING_KEY = (RSAPrivateKey) trusted.getPrivate();
			UNTRUSTED_KEY = (RSAPrivateKey) untrusted.getPrivate();
			var jwks = new JWKSet(
				new RSAKey.Builder((RSAPublicKey) trusted.getPublic()).keyID("cloudflare-test-key").build()).toString();
			JWKS_SERVER = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			JWKS_SERVER.createContext("/certs", (exchange) -> {
				var body = jwks.getBytes(StandardCharsets.UTF_8);
				exchange.getResponseHeaders().add("Content-Type", "application/json");
				exchange.sendResponseHeaders(200, body.length);
				exchange.getResponseBody().write(body);
				exchange.close();
			});
			JWKS_SERVER.start();
			JWKS_URL = "http://127.0.0.1:" + JWKS_SERVER.getAddress().getPort() + "/certs";
		}
		catch (IOException | java.security.NoSuchAlgorithmException exception) {
			throw new IllegalStateException("Impossible de demarrer le JWKS de test", exception);
		}
	}

	@DynamicPropertySource
	static void cloudflareAccessProperties(DynamicPropertyRegistry registry) {
		registry.add("routes-oubliees.cloudflare-access.issuer", () -> ISSUER);
		registry.add("routes-oubliees.cloudflare-access.audience", () -> AUDIENCE);
		registry.add("routes-oubliees.cloudflare-access.certs-url", () -> JWKS_URL);
	}

	@AfterAll
	static void stopJwksServer() {
		JWKS_SERVER.stop(0);
	}

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
		jdbc.update("delete from admin_allowed_emails where email = ?", ADMIN_EMAIL);
		jdbc.update("""
			insert into admin_allowed_emails(id, email, label, active, created_at, updated_at)
			values (?, ?, 'Eclaireur de test', true, now(), now())
			""", UUID.randomUUID(), ADMIN_EMAIL);
	}

	@Test
	void refusesHumanApiWithoutJwt() throws Exception {
		mvc.perform(get("/api/portal/me"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string("X-LRO-Auth-Error", "application"))
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

		mvc.perform(get("/api/public/home"))
			.andExpect(status().isUnauthorized());

		mvc.perform(get("/api/radar/snapshot"))
			.andExpect(status().isUnauthorized());

		mvc.perform(get("/media/11111111-1111-1111-1111-111111111111"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void refusesMalformedJwt() throws Exception {
		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, "ceci-n-est-pas-un-jwt"))
			.andExpect(status().isUnauthorized());

		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, "a.b.c"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void refusesJwtSignedByAnUntrustedKey() throws Exception {
		var forged = token(USER_EMAIL, ISSUER, AUDIENCE, null, Instant.now().plusSeconds(300), UNTRUSTED_KEY);

		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, forged))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void refusesIncorrectAudienceAndIssuer() throws Exception {
		var wrongAudience = token(USER_EMAIL, ISSUER, "autre-audience", null, Instant.now().plusSeconds(300), SIGNING_KEY);
		var wrongIssuer = token(USER_EMAIL, "https://autre.cloudflareaccess.com", AUDIENCE, null,
			Instant.now().plusSeconds(300), SIGNING_KEY);

		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, wrongAudience))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, wrongIssuer))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void refusesExpiredJwtAndNotYetValidJwt() throws Exception {
		var expired = token(USER_EMAIL, ISSUER, AUDIENCE, null, Instant.now().minusSeconds(120), SIGNING_KEY);
		var notYetValid = token(USER_EMAIL, ISSUER, AUDIENCE, Instant.now().plusSeconds(600),
			Instant.now().plusSeconds(900), SIGNING_KEY);

		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, expired))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, notYetValid))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void acceptsValidHumanJwtOnPortalApi() throws Exception {
		mvc.perform(get("/api/portal/me").header(ACCESS_JWT_HEADER, validToken(USER_EMAIL)))
			.andExpect(status().isOk());
	}

	@Test
	void refusesAdminApiForNonAdministratorAndAcceptsAllowlistedAdministrator() throws Exception {
		mvc.perform(get("/api/admin/settings").header(ACCESS_JWT_HEADER, validToken(USER_EMAIL)))
			.andExpect(status().isForbidden());

		mvc.perform(get("/api/admin/settings").header(ACCESS_JWT_HEADER, validToken(ADMIN_EMAIL)))
			.andExpect(status().isOk());
	}

	@Test
	void keepsHomeAssistantEndpointOnItsOwnBearerOnly() throws Exception {
		mvc.perform(post(TREASURE_PATH)
				.header(HttpHeaders.AUTHORIZATION, HOME_ASSISTANT_BEARER)
				.contentType(MediaType.APPLICATION_JSON)
				.content(treasurePayload()))
			.andExpect(status().isNoContent());

		// Un JWT humain, meme valide, ne remplace jamais le Bearer applicatif.
		mvc.perform(post(TREASURE_PATH)
				.header(ACCESS_JWT_HEADER, validToken(ADMIN_EMAIL))
				.contentType(MediaType.APPLICATION_JSON)
				.content(treasurePayload()))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void closesNeighbouringHomeAssistantPathsAndMethodsForHumanIdentities() throws Exception {
		mvc.perform(post("/api/integrations/home-assistant/radar/treasure-position/extra")
				.header(ACCESS_JWT_HEADER, validToken(ADMIN_EMAIL))
				.with(csrf()))
			.andExpect(status().isForbidden());

		mvc.perform(get(TREASURE_PATH).header(ACCESS_JWT_HEADER, validToken(ADMIN_EMAIL)))
			.andExpect(status().isForbidden());

		mvc.perform(put(TREASURE_PATH)
				.header(ACCESS_JWT_HEADER, validToken(ADMIN_EMAIL))
				.with(csrf()))
			.andExpect(status().isForbidden());
	}

	private String treasurePayload() {
		return """
			{
			  "schemaVersion": 1,
			  "beacon": "tresor-aurelune",
			  "latitude": 46.0,
			  "longitude": -1.0,
			  "accuracyM": 5.0,
			  "observedAt": "%s"
			}
			""".formatted(java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC).withNano(0));
	}

	private String validToken(String email) throws Exception {
		return token(email, ISSUER, AUDIENCE, null, Instant.now().plusSeconds(300), SIGNING_KEY);
	}

	private String token(
		String email,
		String issuer,
		String audience,
		Instant notBefore,
		Instant expiresAt,
		RSAPrivateKey signingKey
	) throws Exception {
		var claims = new JWTClaimsSet.Builder()
			.issuer(issuer)
			.audience(audience)
			.subject("subject-" + email)
			.claim("email", email)
			.issueTime(Date.from(Instant.now().minusSeconds(5)))
			.expirationTime(Date.from(expiresAt));
		if (notBefore != null) {
			claims.notBeforeTime(Date.from(notBefore));
		}
		var jwt = new SignedJWT(
			new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("cloudflare-test-key").build(),
			claims.build());
		jwt.sign(new RSASSASigner(signingKey));
		return jwt.serialize();
	}
}
