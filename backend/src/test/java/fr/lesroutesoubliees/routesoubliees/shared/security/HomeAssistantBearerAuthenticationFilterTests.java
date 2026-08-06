package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

class HomeAssistantBearerAuthenticationFilterTests {

	private final HomeAssistantBearerAuthenticationFilter filter =
		new HomeAssistantBearerAuthenticationFilter(new RadarHomeAssistantProperties("secret-token"));

	@AfterEach
	void clearSecurityContext() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void acceptsBearerSchemeWithoutCaseSensitivity() throws Exception {
		var request = request("bEaReR secret-token");
		var response = new MockHttpServletResponse();

		filter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
			.extracting("authority")
			.containsExactly("ROLE_HOME_ASSISTANT");
	}

	@Test
	void rejectsAbsentEmptyIncorrectBasicAndExtraContentTokens() throws Exception {
		for (var header : new String[] { null, "", "Bearer ", "Bearer wrong-token", "Basic secret-token",
				"Bearer secret-token extra" }) {
			SecurityContextHolder.clearContext();
			var request = request(header);
			var response = new MockHttpServletResponse();

			filter.doFilter(request, response, chain());

			assertThat(response.getStatus()).isEqualTo(401);
			assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
			assertThat(response.getHeader(ApplicationAuthenticationEntryPoint.AUTH_ERROR_HEADER))
				.isEqualTo(ApplicationAuthenticationEntryPoint.AUTH_ERROR_APPLICATION);
			assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		}
	}

	@Test
	void rejectsMultipleAuthorizationHeaders() throws Exception {
		var request = request("Bearer secret-token");
		request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer secret-token");
		var response = new MockHttpServletResponse();

		filter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	@Test
	void rejectsWhenConfiguredSecretIsBlank() throws Exception {
		var blankSecretFilter = new HomeAssistantBearerAuthenticationFilter(new RadarHomeAssistantProperties(" "));
		var request = request("Bearer secret-token");
		var response = new MockHttpServletResponse();

		blankSecretFilter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	@Test
	void rejectsOversizedBodiesBeforeController() throws Exception {
		var request = request("Bearer secret-token");
		request.setContent(new byte[HomeAssistantBearerAuthenticationFilter.MAX_BODY_BYTES + 1]);
		var response = new MockHttpServletResponse();

		filter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(413);
	}

	@Test
	void rejectsOversizedBodiesWhenContentLengthIsAbsent() throws Exception {
		var request = requestWithoutContentLength("Bearer secret-token");
		request.setContent(new byte[HomeAssistantBearerAuthenticationFilter.MAX_BODY_BYTES + 1]);
		var response = new MockHttpServletResponse();

		filter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(413);
		assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
	}

	@Test
	void acceptsBodyExactlyAtTheLimitAndReplaysItToTheChain() throws Exception {
		var body = new byte[HomeAssistantBearerAuthenticationFilter.MAX_BODY_BYTES];
		java.util.Arrays.fill(body, (byte) 'x');
		var request = requestWithoutContentLength("Bearer secret-token");
		request.setContent(body);
		var response = new MockHttpServletResponse();
		var replayed = new StringBuilder();

		filter.doFilter(request, response, (servletRequest, servletResponse) -> {
			replayed.append(new String(servletRequest.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
			((MockHttpServletResponse) servletResponse).setStatus(200);
		});

		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(replayed.length()).isEqualTo(HomeAssistantBearerAuthenticationFilter.MAX_BODY_BYTES);
	}

	@Test
	void ignoresOtherMethodsOnTheSamePath() throws Exception {
		var request = new MockHttpServletRequest("GET", HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH);
		request.setRequestURI(HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH);
		var response = new MockHttpServletResponse();

		filter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	private MockHttpServletRequest request(String authorization) {
		return prepare(new MockHttpServletRequest("POST", HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH),
			authorization);
	}

	/** Simule un transfert fragmente : corps present, {@code Content-Length} inconnu. */
	private MockHttpServletRequest requestWithoutContentLength(String authorization) {
		var request = new MockHttpServletRequest("POST", HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH) {

			@Override
			public long getContentLengthLong() {
				return -1;
			}

			@Override
			public int getContentLength() {
				return -1;
			}
		};
		return prepare(request, authorization);
	}

	private MockHttpServletRequest prepare(MockHttpServletRequest request, String authorization) {
		request.setRequestURI(HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH);
		if (authorization != null) {
			request.addHeader(HttpHeaders.AUTHORIZATION, authorization);
		}
		return request;
	}

	private FilterChain chain() {
		return (request, response) -> ((MockHttpServletResponse) response).setStatus(200);
	}
}
