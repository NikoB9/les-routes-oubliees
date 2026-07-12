package fr.lesroutesoubliees.routesoubliees.auth;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
class AdminAllowlistInterceptor implements HandlerInterceptor {

	private final AdminAllowlistService allowlist;
	private final AdminIdentity identity;

	AdminAllowlistInterceptor(AdminAllowlistService allowlist, AdminIdentity identity) {
		this.allowlist = allowlist;
		this.identity = identity;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
		var authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated()) {
			return true;
		}
		var email = identity.email(authentication);
		if (allowlist.isAllowed(email)) {
			return true;
		}
		response.sendError(HttpStatus.FORBIDDEN.value());
		return false;
	}
}
