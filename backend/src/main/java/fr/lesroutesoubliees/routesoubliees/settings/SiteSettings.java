package fr.lesroutesoubliees.routesoubliees.settings;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "site_settings")
class SiteSettings {

	@Id
	private UUID id;

	@Column(name = "site_name", nullable = false, length = 120)
	private String siteName;

	@Column(length = 180)
	private String subtitle;

	@Column(name = "logo_path")
	private String logoPath;

	@Column(nullable = false, length = 80)
	private String timezone;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private SiteStatus status;

	@Column(name = "maintenance_message", length = 500)
	private String maintenanceMessage;

	@Column(name = "accessibility_information_markdown", nullable = false)
	private String accessibilityInformationMarkdown;

	@Column(name = "updated_by", length = 320)
	private String updatedBy;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected SiteSettings() {
	}

	SiteSettings(
		UUID id,
		String siteName,
		String subtitle,
		String logoPath,
		String timezone,
		SiteStatus status,
		String maintenanceMessage,
		String accessibilityInformationMarkdown,
		String updatedBy
	) {
		this.id = id;
		this.siteName = siteName;
		this.subtitle = subtitle;
		this.logoPath = logoPath;
		this.timezone = timezone;
		this.status = status;
		this.maintenanceMessage = maintenanceMessage;
		this.accessibilityInformationMarkdown = accessibilityInformationMarkdown;
		this.updatedBy = updatedBy;
	}

	UUID id() {
		return id;
	}

	String siteName() {
		return siteName;
	}

	String subtitle() {
		return subtitle;
	}

	String logoPath() {
		return logoPath;
	}

	String timezone() {
		return timezone;
	}

	SiteStatus status() {
		return status;
	}

	String maintenanceMessage() {
		return maintenanceMessage;
	}

	String accessibilityInformationMarkdown() {
		return accessibilityInformationMarkdown;
	}

	String updatedBy() {
		return updatedBy;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	OffsetDateTime updatedAt() {
		return updatedAt;
	}

	void update(
		String siteName,
		String subtitle,
		String logoPath,
		String timezone,
		SiteStatus status,
		String maintenanceMessage,
		String accessibilityInformationMarkdown,
		String updatedBy
	) {
		this.siteName = siteName;
		this.subtitle = subtitle;
		this.logoPath = logoPath;
		this.timezone = timezone;
		this.status = status;
		this.maintenanceMessage = maintenanceMessage;
		this.accessibilityInformationMarkdown = accessibilityInformationMarkdown;
		this.updatedBy = updatedBy;
	}

	@PrePersist
	void prePersist() {
		var now = OffsetDateTime.now(ZoneOffset.UTC);
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
	}
}
