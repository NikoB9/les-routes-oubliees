package fr.lesroutesoubliees.routesoubliees.group;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "company_profiles")
class CompanyProfile {

	@Id
	private UUID id;

	@Column(nullable = false, length = 160)
	private String name;

	@Column(name = "emblem_path")
	private String emblemPath;

	@Column(name = "image_alt", length = 280)
	private String imageAlt;

	@Column(name = "short_description", nullable = false, length = 500)
	private String shortDescription;

	@Column(name = "long_description_markdown", nullable = false)
	private String longDescriptionMarkdown;

	@Column(nullable = false)
	private boolean active;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected CompanyProfile() {
	}

	UUID id() {
		return id;
	}

	String name() {
		return name;
	}

	String emblemPath() {
		return emblemPath;
	}

	String imageAlt() {
		return imageAlt;
	}

	String shortDescription() {
		return shortDescription;
	}

	String longDescriptionMarkdown() {
		return longDescriptionMarkdown;
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
