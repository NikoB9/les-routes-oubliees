package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import jakarta.servlet.FilterChain;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import fr.lesroutesoubliees.routesoubliees.auth.AdminAllowlistService;

class CloudflareAccessAuthenticationFilterTests {

	private final JwtDecoder jwtDecoder = mock(JwtDecoder.class);
	private final AdminAllowlistService allowlist = mock(AdminAllowlistService.class);
	private final CloudflareAccessProperties properties = new CloudflareAccessProperties(
		"https://example.cloudflareaccess.com",
		"audience",
		"https://example.cloudflareaccess.com/cdn-cgi/access/certs");
	private final CloudflareAccessAuthenticationFilter filter =
		new CloudflareAccessAuthenticationFilter(jwtDecoder, allowlist);

	@AfterEach
	void clearSecurityContext() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void authenticatesCloudflareUserAndAddsAdminRoleFromAllowlist() throws Exception {
		when(jwtDecoder.decode("valid-token")).thenReturn(jwt("subject-1", "Admin@Example.COM"));
		when(allowlist.normalizeEmail("Admin@Example.COM")).thenReturn(java.util.Optional.of("admin@example.com"));
		when(allowlist.isAllowed("admin@example.com")).thenReturn(true);

		filter.doFilter(requestWithJwt("valid-token", "/api/admin/me"), new MockHttpServletResponse(), chain());

		var authentication = SecurityContextHolder.getContext().getAuthentication();
		assertThat(authentication).isNotNull();
		assertThat(authentication.getAuthorities())
			.extracting("authority")
			.containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN");
		assertThat(authentication.getPrincipal())
			.isEqualTo(new CloudflareAccessPrincipal("subject-1", "admin@example.com"));
	}

	@Test
	void ignoresForgedEmailHeaderWithoutValidJwt() throws Exception {
		when(jwtDecoder.decode("invalid-token")).thenThrow(new JwtException("invalid"));

		var request = requestWithJwt("invalid-token", "/api/radar/snapshot");
		request.addHeader("Cf-Access-Authenticated-User-Email", "admin@example.com");

		filter.doFilter(request, new MockHttpServletResponse(), chain());

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	@Test
	void ignoresJwtWithoutHumanEmail() throws Exception {
		when(jwtDecoder.decode("valid-token")).thenReturn(jwt("subject-1", null));

		filter.doFilter(requestWithJwt("valid-token", "/api/radar/snapshot"), new MockHttpServletResponse(), chain());

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	@Test
	void ignoresMissingJwt() throws Exception {
		var request = new MockHttpServletRequest("GET", "/api/radar/snapshot");
		request.setRequestURI("/api/radar/snapshot");

		filter.doFilter(request, new MockHttpServletResponse(), chain());

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	@Test
	void ignoresInvalidJwtCasesRejectedByDecoder() throws Exception {
		for (var token : List.of("expired", "not-yet-valid", "bad-signature", "bad-issuer", "bad-audience")) {
			SecurityContextHolder.clearContext();
			when(jwtDecoder.decode(token)).thenThrow(new JwtException(token));

			filter.doFilter(requestWithJwt(token, "/api/radar/snapshot"), new MockHttpServletResponse(), chain());

			assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		}
	}

	private MockHttpServletRequest requestWithJwt(String token, String path) {
		var request = new MockHttpServletRequest("GET", path);
		request.addHeader("Cf-Access-Jwt-Assertion", token);
		request.setRequestURI(path);
		return request;
	}

	private FilterChain chain() {
		return (request, response) -> {
		};
	}

	private Jwt jwt(String subject, String email) {
		var claims = new java.util.HashMap<String, Object>();
		claims.put("sub", subject);
		claims.put("aud", List.of("audience"));
		if (email != null) {
			claims.put("email", email);
		}
		return new Jwt(
			"token",
			Instant.now(),
			Instant.now().plusSeconds(60),
			Map.of("alg", "RS256"),
			claims);
	}
}
