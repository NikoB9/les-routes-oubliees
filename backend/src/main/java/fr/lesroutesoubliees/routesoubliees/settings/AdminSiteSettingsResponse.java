package fr.lesroutesoubliees.routesoubliees.settings;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminSiteSettingsResponse(
	UUID id,
	String siteName,
	String subtitle,
	String logoPath,
	String timezone,
	SiteStatus status,
	String maintenanceMessage,
	String accessibilityInformationMarkdown,
	String updatedBy,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
