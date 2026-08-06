package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.io.IOException;
import java.util.ArrayList;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import fr.lesroutesoubliees.routesoubliees.auth.AdminAllowlistService;

@Component
class CloudflareAccessAuthenticationFilter extends OncePerRequestFilter {

	private static final String ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

	private final JwtDecoder jwtDecoder;
	private final AdminAllowlistService adminAllowlist;

	CloudflareAccessAuthenticationFilter(
		JwtDecoder jwtDecoder,
		AdminAllowlistService adminAllowlist
	) {
		this.jwtDecoder = jwtDecoder;
		this.adminAllowlist = adminAllowlist;
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		var token = request.getHeader(ACCESS_JWT_HEADER);
		if (!StringUtils.hasText(token)) {
			filterChain.doFilter(request, response);
			return;
		}

		try {
			var jwt = jwtDecoder.decode(token);
			var subject = jwt.getSubject();
			var email = normalizedEmail(jwt.getClaimAsString("email"));
			var authorities = new ArrayList<SimpleGrantedAuthority>();

			if (StringUtils.hasText(email)) {
				authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
				if (adminAllowlist.isAllowed(email)) {
					authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
				}
			}

			if (!authorities.isEmpty()) {
				var principal = new CloudflareAccessPrincipal(subject, email);
				var authentication = new UsernamePasswordAuthenticationToken(principal, token, authorities);
				SecurityContextHolder.getContext().setAuthentication(authentication);
			}
		}
		catch (JwtException exception) {
			SecurityContextHolder.clearContext();
		}

		filterChain.doFilter(request, response);
	}

	private String normalizedEmail(String email) {
		return adminAllowlist.normalizeEmail(email).orElse(null);
	}
}
