package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.stereotype.Service;

@Service
class AdminOidcAuthorizationService {

	private final AdminAllowlistService allowlistService;

	AdminOidcAuthorizationService(AdminAllowlistService allowlistService) {
		this.allowlistService = allowlistService;
	}

	void verifyAdminAccess(String email, Boolean emailVerified) {
		if (email == null || email.isBlank()) {
			throw new AdminAccessDeniedException("Google account did not provide an email.");
		}
		if (!Boolean.TRUE.equals(emailVerified)) {
			throw new AdminAccessDeniedException("Google account email is not verified.");
		}
		if (!allowlistService.isAllowed(email)) {
			throw new AdminAccessDeniedException("Google account is not allowed to administer this site.");
		}
	}
}
