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
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import fr.lesroutesoubliees.routesoubliees.auth.AdminAllowlistService;
import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

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
	private static final String FALLBACK_EMAIL = "dev-local@example.invalid";

	private final AdminAllowlistService adminAllowlist;
	private final String localEmail;

	DevelopmentIdentityFilter(AdminAllowlistService adminAllowlist, SiteProperties siteProperties) {
		this.adminAllowlist = adminAllowlist;
		this.localEmail = localEmail(siteProperties);
	}

	/**
	 * Adresse de l'identite locale.
	 *
	 * <p>La premiere adresse d'amorcage administrateur est reutilisee afin que
	 * l'administration soit reellement accessible en developpement : une adresse absente de
	 * l'allowlist rendrait {@code /admin} inatteignable sans intervention manuelle.
	 */
	private static String localEmail(SiteProperties siteProperties) {
		var bootstrapEmails = siteProperties.adminBootstrapEmails();
		if (bootstrapEmails == null) {
			return FALLBACK_EMAIL;
		}
		return bootstrapEmails.stream()
			.filter(StringUtils::hasText)
			.map(String::trim)
			.findFirst()
			.orElse(FALLBACK_EMAIL);
	}

	@PostConstruct
	void warnAboutDevelopmentIdentity() {
		LOGGER.warn(
			"Profil dev actif : l'identite locale {} remplace Cloudflare Access. Ne jamais utiliser ce profil sur un serveur.",
			this.localEmail);
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
			if (adminAllowlist.isAllowed(this.localEmail)) {
				authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
			}
			var principal = new CloudflareAccessPrincipal(LOCAL_SUBJECT, this.localEmail);
			SecurityContextHolder.getContext()
				.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
		}
		filterChain.doFilter(request, response);
	}
}
