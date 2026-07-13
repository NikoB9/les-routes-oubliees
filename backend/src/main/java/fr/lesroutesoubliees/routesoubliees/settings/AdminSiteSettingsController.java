package fr.lesroutesoubliees.routesoubliees.settings;

import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/admin/settings")
class AdminSiteSettingsController {

	private final SiteSettingsService settings;
	private final AdminIdentity identity;

	AdminSiteSettingsController(SiteSettingsService settings, AdminIdentity identity) {
		this.settings = settings;
		this.identity = identity;
	}

	@GetMapping
	AdminSiteSettingsResponse getSettings() {
		return settings.adminSettings();
	}

	@PutMapping
	AdminSiteSettingsResponse updateSettings(
		@Valid @RequestBody SiteSettingsUpdateRequest request,
		Authentication authentication
	) {
		return settings.updateSettings(request, identity.email(authentication));
	}
}
