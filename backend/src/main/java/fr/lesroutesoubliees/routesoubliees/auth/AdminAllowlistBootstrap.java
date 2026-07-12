package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

@Component
class AdminAllowlistBootstrap implements ApplicationRunner {

	private final SiteProperties siteProperties;
	private final AdminAllowlistService allowlistService;

	AdminAllowlistBootstrap(SiteProperties siteProperties, AdminAllowlistService allowlistService) {
		this.siteProperties = siteProperties;
		this.allowlistService = allowlistService;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (allowlistService.hasAnyAdmin() || siteProperties.adminBootstrapEmails() == null) {
			return;
		}

		siteProperties.adminBootstrapEmails().forEach(allowlistService::bootstrapAdmin);
	}
}
