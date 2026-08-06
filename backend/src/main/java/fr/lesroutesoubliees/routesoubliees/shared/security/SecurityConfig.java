package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.util.function.Supplier;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.util.StringUtils;

@Configuration
@EnableConfigurationProperties({ CloudflareAccessProperties.class, RadarHomeAssistantProperties.class })
class SecurityConfig {

	/**
	 * Regles d'acces.
	 *
	 * <p>Ordre volontaire : l'unique {@code POST} Home Assistant est traite avant toute
	 * autre regle, les chemins voisins sont fermes, puis toutes les API humaines exigent
	 * une identite Cloudflare valide.
	 *
	 * <p>Les seules ressources laissees accessibles par Spring sont :
	 * <ul>
	 * <li>{@code /} : racine servie par le reverse proxy, jamais par Spring en production ;
	 * <li>{@code /error} : dispatch interne d'erreur du conteneur servlet ;
	 * <li>{@code /actuator/health} : sonde de disponibilite, restreinte au loopback par Nginx.
	 * </ul>
	 * Tout le reste, y compris {@code /media/**}, exige une identite Cloudflare.
	 */
	@Bean
	SecurityFilterChain securityFilterChain(
		HttpSecurity http,
		CloudflareAccessAuthenticationFilter cloudflareAccessAuthenticationFilter,
		HomeAssistantBearerAuthenticationFilter homeAssistantBearerAuthenticationFilter,
		ObjectProvider<DevelopmentIdentityFilter> developmentIdentityFilter
	) throws Exception {
		http
			.authorizeHttpRequests((authorize) -> authorize
				.requestMatchers(HttpMethod.POST, HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH).hasRole("HOME_ASSISTANT")
				.requestMatchers(HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH).denyAll()
				.requestMatchers("/api/integrations/**").denyAll()
				.requestMatchers("/api/admin/**").hasRole("ADMIN")
				.requestMatchers("/api/**", "/media/**").hasRole("USER")
				.requestMatchers("/", "/error", "/actuator/health").permitAll()
				.anyRequest().denyAll())
			.exceptionHandling((exceptions) -> exceptions
				.authenticationEntryPoint(new ApplicationAuthenticationEntryPoint()))
			.sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf((csrf) -> csrf
				.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
				.csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
				.ignoringRequestMatchers(HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH))
			.addFilterBefore(homeAssistantBearerAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
			.addFilterBefore(cloudflareAccessAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
		developmentIdentityFilter.ifAvailable((filter) ->
			http.addFilterAfter(filter, CloudflareAccessAuthenticationFilter.class));
		return http.build();
	}

	@Bean
	HomeAssistantBearerAuthenticationFilter homeAssistantBearerAuthenticationFilter(
		RadarHomeAssistantProperties properties
	) {
		return new HomeAssistantBearerAuthenticationFilter(properties);
	}

	@Bean
	JwtDecoder jwtDecoder(CloudflareAccessProperties properties) {
		var decoder = NimbusJwtDecoder.withJwkSetUri(properties.certsUrl()).build();
		OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
			new JwtTimestampValidator(),
			new JwtClaimValidator<String>("iss", properties.issuer()::equals),
			new JwtClaimValidator<java.util.List<String>>("aud", (audience) -> audience != null && audience.contains(properties.audience()))
		);
		decoder.setJwtValidator(validator);
		return decoder;
	}

	private static final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {

		private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
		private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

		@Override
		public void handle(HttpServletRequest request, HttpServletResponse response, Supplier<CsrfToken> csrfToken) {
			xor.handle(request, response, csrfToken);
			csrfToken.get();
		}

		@Override
		public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
			var header = request.getHeader(csrfToken.getHeaderName());
			var handler = StringUtils.hasText(header) ? plain : xor;
			return handler.resolveCsrfTokenValue(request, csrfToken);
		}
	}
}
