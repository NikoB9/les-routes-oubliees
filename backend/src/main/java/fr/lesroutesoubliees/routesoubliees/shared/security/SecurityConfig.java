package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.springframework.security.config.Customizer.withDefaults;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

import fr.lesroutesoubliees.routesoubliees.auth.AdminOidcUserService;

@Configuration
class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(
		HttpSecurity http,
		ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository,
		AdminOidcUserService adminOidcUserService
	) throws Exception {
		http
			.authorizeHttpRequests((authorize) -> authorize
				.requestMatchers("/", "/error", "/actuator/health").permitAll()
				.requestMatchers("/oauth2/**", "/login/**").permitAll()
				.requestMatchers("/api/public/**", "/media/**").permitAll()
				.requestMatchers("/api/admin/**", "/admin/**").authenticated()
				.anyRequest().permitAll())
			.csrf((csrf) -> csrf
				.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()));

		if (clientRegistrationRepository.getIfAvailable() != null) {
			http.oauth2Login((oauth2) -> oauth2
				.defaultSuccessUrl("/admin", true)
				.failureUrl("/admin/login?error=access_denied")
				.userInfoEndpoint((userInfo) -> userInfo
					.oidcUserService(adminOidcUserService)));
		}

		return http
			.logout(withDefaults())
			.build();
	}
}
