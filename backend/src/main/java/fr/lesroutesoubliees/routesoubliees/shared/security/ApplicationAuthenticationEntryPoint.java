package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/**
 * Point d'entree des requetes non authentifiees.
 *
 * <p>Marque explicitement les {@code 401} produits par l'application afin que le
 * frontend ne les confonde pas avec une expiration de session Cloudflare Access, qui
 * est renvoyee par Cloudflare avant l'origine et ne porte donc pas ce marqueur.
 */
class ApplicationAuthenticationEntryPoint implements AuthenticationEntryPoint {

	/** En-tete marqueur d'un refus emis par l'application elle-meme. */
	static final String AUTH_ERROR_HEADER = "X-LRO-Auth-Error";

	/** Valeur stable du marqueur applicatif. */
	static final String AUTH_ERROR_APPLICATION = "application";

	private static final String PROBLEM_BODY = """
		{"type":"about:blank","title":"Unauthorized","status":401,\
		"detail":"Identite Cloudflare Access requise.","code":"application-unauthenticated"}""";

	@Override
	public void commence(
		HttpServletRequest request,
		HttpServletResponse response,
		AuthenticationException authenticationException
	) throws IOException {
		if (response.isCommitted()) {
			return;
		}
		response.setStatus(HttpStatus.UNAUTHORIZED.value());
		response.setHeader(AUTH_ERROR_HEADER, AUTH_ERROR_APPLICATION);
		response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.getWriter().write(PROBLEM_BODY);
	}
}
