package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

class HomeAssistantBearerAuthenticationFilter extends OncePerRequestFilter {

	static final String TREASURE_POSITION_PATH = "/api/integrations/home-assistant/radar/treasure-position";
	private static final int MAX_BODY_BYTES = 4096;

	private final RadarHomeAssistantProperties properties;

	HomeAssistantBearerAuthenticationFilter(RadarHomeAssistantProperties properties) {
		this.properties = properties;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !TREASURE_POSITION_PATH.equals(request.getRequestURI());
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		if (!HttpMethod.POST.matches(request.getMethod())) {
			filterChain.doFilter(request, response);
			return;
		}
		response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
		if (request.getContentLengthLong() > MAX_BODY_BYTES) {
			response.sendError(413);
			return;
		}
		var authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
		var token = extractBearerToken(authorization);
		if (!constantTimeEquals(token, properties.token())) {
			response.sendError(HttpStatus.UNAUTHORIZED.value());
			return;
		}

		var authentication = new UsernamePasswordAuthenticationToken(
			"home-assistant",
			null,
			List.of(new SimpleGrantedAuthority("ROLE_HOME_ASSISTANT")));
		SecurityContextHolder.getContext().setAuthentication(authentication);
		filterChain.doFilter(request, response);
	}

	private String extractBearerToken(String authorization) {
		if (!StringUtils.hasText(authorization)) {
			return null;
		}
		var parts = authorization.trim().split("\\s+", -1);
		if (parts.length != 2 || !"bearer".equalsIgnoreCase(parts[0]) || !StringUtils.hasText(parts[1])) {
			return null;
		}
		return parts[1];
	}

	private boolean constantTimeEquals(String provided, String expected) {
		if (!StringUtils.hasText(provided) || !StringUtils.hasText(expected)) {
			return false;
		}
		return MessageDigest.isEqual(sha256(provided), sha256(expected));
	}

	private byte[] sha256(String value) {
		try {
			return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is not available", exception);
		}
	}
}
