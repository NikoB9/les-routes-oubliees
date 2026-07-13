package fr.lesroutesoubliees.routesoubliees.settings;

public record PublicSiteSettingsResponse(
	String siteName,
	String subtitle,
	String logoPath,
	String timezone,
	SiteStatus status,
	String maintenanceMessage,
	String accessibilityInformationMarkdown
) {
}
