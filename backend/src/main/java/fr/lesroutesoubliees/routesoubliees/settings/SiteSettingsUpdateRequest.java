package fr.lesroutesoubliees.routesoubliees.settings;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SiteSettingsUpdateRequest(
	@NotBlank @Size(max = 120) String siteName,
	@Size(max = 180) String subtitle,
	@Size(max = 255) String logoPath,
	@NotBlank @Size(max = 80) String timezone,
	@NotNull SiteStatus status,
	@Size(max = 500) String maintenanceMessage,
	@NotBlank @Size(max = 4000) String accessibilityInformationMarkdown
) {
}
