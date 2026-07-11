package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
public class AdminOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

	private final OidcUserService delegate = new OidcUserService();
	private final AdminOidcAuthorizationService authorizationService;

	AdminOidcUserService(AdminOidcAuthorizationService authorizationService) {
		this.authorizationService = authorizationService;
	}

	@Override
	public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
		var user = delegate.loadUser(userRequest);
		try {
			authorizationService.verifyAdminAccess(user.getEmail(), user.getEmailVerified());
		}
		catch (AdminAccessDeniedException exception) {
			throw new OAuth2AuthenticationException(
				new OAuth2Error("admin_access_denied"),
				"Accès réservé aux éclaireurs autorisés.",
				exception
			);
		}
		return user;
	}
}
