package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

class HomeAssistantBearerAuthenticationFilter extends OncePerRequestFilter {

	/**
	 * Journal des refus.
	 *
	 * <p>Seul point d'entree non protege par Cloudflare Access : sans trace, une tentative
	 * repetee resterait invisible. Seule la categorie du motif est journalisee, jamais le
	 * jeton presente ni le corps recu.
	 */
	private static final Logger LOGGER = LoggerFactory.getLogger(HomeAssistantBearerAuthenticationFilter.class);

	static final String TREASURE_POSITION_PATH = "/api/integrations/home-assistant/radar/treasure-position";

	/** Limite stricte du corps accepte sur ce seul chemin. */
	static final int MAX_BODY_BYTES = 4096;

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
			reject(response, HttpStatus.PAYLOAD_TOO_LARGE, "taille de corps annoncee au-dela de la limite");
			return;
		}
		var authorizationHeaders = Collections.list(request.getHeaders(HttpHeaders.AUTHORIZATION));
		if (authorizationHeaders.size() != 1) {
			reject(response, HttpStatus.UNAUTHORIZED, "en-tete Authorization absent ou duplique");
			return;
		}
		var token = extractBearerToken(authorizationHeaders.getFirst());
		if (!constantTimeEquals(token, properties.token())) {
			reject(response, HttpStatus.UNAUTHORIZED, "jeton Bearer invalide");
			return;
		}

		// La limite ne peut pas reposer sur Content-Length : l'en-tete est absent en
		// transfert fragmente et reste declaratif. Le corps est donc lu de maniere bornee
		// puis rejoue au controleur, sans jamais etre journalise.
		var body = readBoundedBody(request.getInputStream());
		if (body == null) {
			reject(response, HttpStatus.PAYLOAD_TOO_LARGE, "corps recu au-dela de la limite");
			return;
		}

		var authentication = new UsernamePasswordAuthenticationToken(
			"home-assistant",
			null,
			List.of(new SimpleGrantedAuthority("ROLE_HOME_ASSISTANT")));
		SecurityContextHolder.getContext().setAuthentication(authentication);
		filterChain.doFilter(new BoundedBodyRequest(request, body), response);
	}

	private void reject(HttpServletResponse response, HttpStatus status, String reason) throws IOException {
		LOGGER.warn("Publication Home Assistant refusee ({}) : {}.", status.value(), reason);
		if (status == HttpStatus.UNAUTHORIZED) {
			response.setHeader(
				ApplicationAuthenticationEntryPoint.AUTH_ERROR_HEADER,
				ApplicationAuthenticationEntryPoint.AUTH_ERROR_APPLICATION);
		}
		response.sendError(status.value());
	}

	/**
	 * Lit au plus {@link #MAX_BODY_BYTES} octets.
	 *
	 * @return le corps complet, ou {@code null} lorsque la limite est depassee
	 */
	private byte[] readBoundedBody(InputStream input) throws IOException {
		var buffer = new byte[MAX_BODY_BYTES + 1];
		var total = 0;
		while (total < buffer.length) {
			var read = input.read(buffer, total, buffer.length - total);
			if (read < 0) {
				break;
			}
			total += read;
		}
		return total > MAX_BODY_BYTES ? null : Arrays.copyOf(buffer, total);
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

	/** Rejoue le corps deja lu et borne, sans exposer le flux d'origine. */
	private static final class BoundedBodyRequest extends HttpServletRequestWrapper {

		private final byte[] body;

		private BoundedBodyRequest(HttpServletRequest request, byte[] body) {
			super(request);
			this.body = body;
		}

		@Override
		public int getContentLength() {
			return this.body.length;
		}

		@Override
		public long getContentLengthLong() {
			return this.body.length;
		}

		@Override
		public ServletInputStream getInputStream() {
			var delegate = new ByteArrayInputStream(this.body);
			return new ServletInputStream() {

				@Override
				public boolean isFinished() {
					return delegate.available() == 0;
				}

				@Override
				public boolean isReady() {
					return true;
				}

				@Override
				public void setReadListener(ReadListener readListener) {
					throw new UnsupportedOperationException("Lecture asynchrone non supportee sur ce chemin.");
				}

				@Override
				public int read() {
					return delegate.read();
				}

				@Override
				public int read(byte[] buffer, int offset, int length) {
					return delegate.read(buffer, offset, length);
				}
			};
		}

		@Override
		public BufferedReader getReader() {
			return new BufferedReader(new InputStreamReader(getInputStream(), charset()));
		}

		private Charset charset() {
			var encoding = getCharacterEncoding();
			if (!StringUtils.hasText(encoding)) {
				return StandardCharsets.UTF_8;
			}
			try {
				return Charset.forName(encoding);
			}
			catch (RuntimeException exception) {
				return StandardCharsets.UTF_8;
			}
		}
	}
}
