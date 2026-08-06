package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtException;

class CloudflareAccessJwtDecoderTests {

	private HttpServer server;
	private java.security.interfaces.RSAPrivateKey privateKey;
	private java.security.interfaces.RSAPrivateKey otherPrivateKey;
	private String jwksUrl;

	@BeforeEach
	void setUp() throws Exception {
		var generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		var keyPair = generator.generateKeyPair();
		var otherKeyPair = generator.generateKeyPair();
		privateKey = (java.security.interfaces.RSAPrivateKey) keyPair.getPrivate();
		otherPrivateKey = (java.security.interfaces.RSAPrivateKey) otherKeyPair.getPrivate();
		var publicJwk = new RSAKey.Builder((RSAPublicKey) keyPair.getPublic()).keyID("test-key").build();
		var jwks = new JWKSet(publicJwk).toString();
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/certs", (exchange) -> {
			var body = jwks.getBytes(java.nio.charset.StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
		jwksUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/certs";
	}

	@AfterEach
	void tearDown() {
		if (server != null) {
			server.stop(0);
		}
	}

	@Test
	void decodesHumanCloudflareTokenWithExpectedIssuerAudienceAndSignature() throws Exception {
		var decoder = decoder();

		var jwt = decoder.decode(token("https://team.cloudflareaccess.com", "human-audience", null, Instant.now().plusSeconds(60), privateKey));

		assertThat(jwt.getClaimAsString("email")).isEqualTo("user@example.invalid");
	}

	@Test
	void rejectsInvalidCloudflareTokenCases() throws Exception {
		var decoder = decoder();
		assertThatThrownBy(() -> decoder.decode(token("https://team.cloudflareaccess.com", "human-audience", null, Instant.now().minusSeconds(60), privateKey)))
			.isInstanceOf(JwtException.class);
		assertThatThrownBy(() -> decoder.decode(token("https://team.cloudflareaccess.com", "human-audience", Instant.now().plusSeconds(120), Instant.now().plusSeconds(180), privateKey)))
			.isInstanceOf(JwtException.class);
		assertThatThrownBy(() -> decoder.decode(token("https://other.cloudflareaccess.com", "human-audience", null, Instant.now().plusSeconds(60), privateKey)))
			.isInstanceOf(JwtException.class);
		assertThatThrownBy(() -> decoder.decode(token("https://team.cloudflareaccess.com", "other-audience", null, Instant.now().plusSeconds(60), privateKey)))
			.isInstanceOf(JwtException.class);
		assertThatThrownBy(() -> decoder.decode(token("https://team.cloudflareaccess.com", "human-audience", null, Instant.now().plusSeconds(60), otherPrivateKey)))
			.isInstanceOf(JwtException.class);
	}

	private org.springframework.security.oauth2.jwt.JwtDecoder decoder() {
		return new SecurityConfig().jwtDecoder(new CloudflareAccessProperties(
			"https://team.cloudflareaccess.com",
			"human-audience",
			jwksUrl));
	}

	private String token(
		String issuer,
		String audience,
		Instant notBefore,
		Instant expiresAt,
		java.security.interfaces.RSAPrivateKey signingKey
	) throws Exception {
		var claims = new JWTClaimsSet.Builder()
			.issuer(issuer)
			.audience(audience)
			.subject("subject")
			.claim("email", "user@example.invalid")
			.issueTime(new Date())
			.expirationTime(Date.from(expiresAt));
		if (notBefore != null) {
			claims.notBeforeTime(Date.from(notBefore));
		}
		var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(), claims.build());
		jwt.sign(new RSASSASigner(signingKey));
		return jwt.serialize();
	}
}
