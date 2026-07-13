package fr.lesroutesoubliees.routesoubliees.settings;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
public class SiteSettingsService {

	private final SiteSettingsRepository repository;
	private final AuditService audit;

	SiteSettingsService(SiteSettingsRepository repository, AuditService audit) {
		this.repository = repository;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public PublicSiteSettingsResponse publicSettings() {
		return toPublicResponse(currentSettingsOrDefault());
	}

	@Transactional(readOnly = true)
	public AdminSiteSettingsResponse adminSettings() {
		return toAdminResponse(currentSettingsOrDefault());
	}

	@Transactional
	public AdminSiteSettingsResponse updateSettings(SiteSettingsUpdateRequest request, String actorEmail) {
		validate(request);
		var settings = currentSettingsForUpdate();
		settings.update(
			request.siteName().trim(),
			trimToNull(request.subtitle()),
			trimToNull(request.logoPath()),
			normalizedTimezone(request.timezone()),
			request.status(),
			trimToNull(request.maintenanceMessage()),
			request.accessibilityInformationMarkdown().trim(),
			actorEmail);
		repository.save(settings);
		audit.record(actorEmail, "SITE_SETTINGS_UPDATED", "SITE_SETTINGS", settings.id().toString(), "Paramètres du site modifiés");
		return toAdminResponse(settings);
	}

	private SiteSettings currentSettingsOrDefault() {
		return repository.findFirstByOrderByUpdatedAtDesc()
			.orElseGet(this::defaultSettings);
	}

	private SiteSettings currentSettingsForUpdate() {
		return repository.findFirstByOrderByUpdatedAtDesc()
			.orElseGet(() -> repository.save(defaultSettings()));
	}

	private SiteSettings defaultSettings() {
		return new SiteSettings(
			UUID.randomUUID(),
			"Les Routes Oubliées",
			"Compagnie d'Arkhavel",
			"/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d",
			"Europe/Paris",
			SiteStatus.ONLINE,
			null,
			"Les informations d'accessibilité détaillées seront publiées avant la mise en production.",
			null);
	}

	private void validate(SiteSettingsUpdateRequest request) {
		normalizedTimezone(request.timezone());
		var logoPath = trimToNull(request.logoPath());
		if (logoPath != null && !isSafeLogoPath(logoPath)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Logo path must be a public asset or media URL");
		}
		if (request.status() == SiteStatus.MAINTENANCE && trimToNull(request.maintenanceMessage()) == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance message is required");
		}
	}

	private boolean isSafeLogoPath(String logoPath) {
		return logoPath.matches("^/assets/[A-Za-z0-9/_-]+\\.(png|jpg|jpeg|webp)(\\?[A-Za-z0-9._=-]+)?$")
			|| logoPath.matches("^/media/[0-9a-fA-F-]{36}$");
	}

	private String normalizedTimezone(String timezone) {
		try {
			return ZoneId.of(timezone.trim()).getId();
		}
		catch (DateTimeException exception) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Timezone is invalid");
		}
	}

	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

	private AdminSiteSettingsResponse toAdminResponse(SiteSettings settings) {
		return new AdminSiteSettingsResponse(
			settings.id(),
			settings.siteName(),
			settings.subtitle(),
			settings.logoPath(),
			settings.timezone(),
			settings.status(),
			settings.maintenanceMessage(),
			settings.accessibilityInformationMarkdown(),
			settings.updatedBy(),
			settings.createdAt(),
			settings.updatedAt());
	}

	private PublicSiteSettingsResponse toPublicResponse(SiteSettings settings) {
		return new PublicSiteSettingsResponse(
			settings.siteName(),
			settings.subtitle(),
			settings.logoPath(),
			settings.timezone(),
			settings.status(),
			settings.maintenanceMessage(),
			settings.accessibilityInformationMarkdown());
	}
}
