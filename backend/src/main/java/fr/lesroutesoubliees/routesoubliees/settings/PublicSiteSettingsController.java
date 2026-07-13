package fr.lesroutesoubliees.routesoubliees.settings;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/settings")
class PublicSiteSettingsController {

	private final SiteSettingsService settings;

	PublicSiteSettingsController(SiteSettingsService settings) {
		this.settings = settings;
	}

	@GetMapping
	PublicSiteSettingsResponse getSettings() {
		return settings.publicSettings();
	}
}
