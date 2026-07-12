package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.stereotype.Service;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
class AdminOidcAuthorizationService {

	private final AdminAllowlistService allowlistService;
	private final AuditService audit;

	AdminOidcAuthorizationService(AdminAllowlistService allowlistService, AuditService audit) {
		this.allowlistService = allowlistService;
		this.audit = audit;
	}

	void verifyAdminAccess(String email, Boolean emailVerified) {
		if (email == null || email.isBlank()) {
			audit.record(null, "ADMIN_LOGIN_REFUSED", "ADMIN_SESSION", null, "Connexion admin refusee");
			throw new AdminAccessDeniedException("Google account did not provide an email.");
		}
		if (!Boolean.TRUE.equals(emailVerified)) {
			audit.record(email, "ADMIN_LOGIN_REFUSED", "ADMIN_SESSION", null, "Connexion admin refusee");
			throw new AdminAccessDeniedException("Google account email is not verified.");
		}
		if (!allowlistService.isAllowed(email)) {
			audit.record(email, "ADMIN_LOGIN_REFUSED", "ADMIN_SESSION", null, "Connexion admin refusee");
			throw new AdminAccessDeniedException("Google account is not allowed to administer this site.");
		}
		audit.record(email, "ADMIN_LOGIN_SUCCEEDED", "ADMIN_SESSION", null, "Connexion admin acceptee");
	}
}
