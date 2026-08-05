package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.util.function.Supplier;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

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

	@Bean
	SecurityFilterChain securityFilterChain(
		HttpSecurity http,
		CloudflareAccessAuthenticationFilter cloudflareAccessAuthenticationFilter,
		HomeAssistantBearerAuthenticationFilter homeAssistantBearerAuthenticationFilter
	) throws Exception {
		return http
			.authorizeHttpRequests((authorize) -> authorize
				.requestMatchers("/", "/error", "/actuator/health").permitAll()
				.requestMatchers("/api/public/**", "/media/**").permitAll()
				.requestMatchers("/api/portal/**", "/api/radar/**").hasRole("USER")
				.requestMatchers("/api/admin/**").hasRole("ADMIN")
				.requestMatchers(HttpMethod.POST, HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH).hasRole("HOME_ASSISTANT")
				.requestMatchers(HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH).denyAll()
				.requestMatchers("/api/integrations/**").denyAll()
				.anyRequest().permitAll())
			.sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf((csrf) -> csrf
				.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
				.csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
				.ignoringRequestMatchers("/api/integrations/home-assistant/radar/treasure-position"))
			.addFilterBefore(homeAssistantBearerAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
			.addFilterBefore(cloudflareAccessAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
			.build();
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
