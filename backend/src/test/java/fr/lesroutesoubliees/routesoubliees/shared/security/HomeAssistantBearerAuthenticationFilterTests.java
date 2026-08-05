package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.assertj.core.api.Assertions.assertThat;

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
			assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		}
	}

	@Test
	void rejectsOversizedBodiesBeforeController() throws Exception {
		var request = request("Bearer secret-token");
		request.setContent(new byte[4097]);
		var response = new MockHttpServletResponse();

		filter.doFilter(request, response, chain());

		assertThat(response.getStatus()).isEqualTo(413);
	}

	private MockHttpServletRequest request(String authorization) {
		var request = new MockHttpServletRequest("POST", HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH);
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
