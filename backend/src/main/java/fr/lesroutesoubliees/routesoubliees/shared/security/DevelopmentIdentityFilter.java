package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.io.IOException;
import java.util.ArrayList;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import fr.lesroutesoubliees.routesoubliees.auth.AdminAllowlistService;

/**
 * Identite locale de developpement.
 *
 * <p>Cloudflare Access n'existe pas devant un poste de developpement : sans identite,
 * toutes les API humaines repondraient {@code 401}. Ce filtre fournit donc une identite
 * factice, uniquement sous le profil {@code dev}.
 *
 * <p>Il n'accorde jamais de droit sur le chemin Home Assistant, qui conserve son Bearer
 * applicatif. Le profil {@code prod} refuse de demarrer si le profil {@code dev} est actif
 * en meme temps.
 */
@Component
@Profile("dev")
class DevelopmentIdentityFilter extends OncePerRequestFilter {

	private static final Logger LOGGER = LoggerFactory.getLogger(DevelopmentIdentityFilter.class);
	private static final String LOCAL_SUBJECT = "dev-local-subject";
	private static final String LOCAL_EMAIL = "dev-local@example.invalid";

	private final AdminAllowlistService adminAllowlist;

	DevelopmentIdentityFilter(AdminAllowlistService adminAllowlist) {
		this.adminAllowlist = adminAllowlist;
	}

	@PostConstruct
	void warnAboutDevelopmentIdentity() {
		LOGGER.warn(
			"Profil dev actif : une identite locale factice remplace Cloudflare Access. Ne jamais utiliser ce profil sur un serveur.");
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return HomeAssistantBearerAuthenticationFilter.TREASURE_POSITION_PATH.equals(request.getRequestURI());
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			var authorities = new ArrayList<SimpleGrantedAuthority>();
			authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
			if (adminAllowlist.isAllowed(LOCAL_EMAIL)) {
				authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
			}
			var principal = new CloudflareAccessPrincipal(LOCAL_SUBJECT, LOCAL_EMAIL);
			SecurityContextHolder.getContext()
				.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
		}
		filterChain.doFilter(request, response);
	}
}
