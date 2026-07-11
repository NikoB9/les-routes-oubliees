package fr.lesroutesoubliees.routesoubliees.map;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "map_visions")
class MapVision {

	@Id
	private UUID id;

	@Column(nullable = false, length = 160)
	private String name;

	@Column(name = "description_markdown", nullable = false)
	private String descriptionMarkdown;

	@Column(name = "asset_path", nullable = false)
	private String assetPath;

	@Column(name = "image_alt", nullable = false, length = 280)
	private String imageAlt;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private EditorialStatus status;

	@Column(nullable = false)
	private boolean active;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected MapVision() {
	}

	UUID id() {
		return id;
	}

	String name() {
		return name;
	}

	String descriptionMarkdown() {
		return descriptionMarkdown;
	}

	String assetPath() {
		return assetPath;
	}

	String imageAlt() {
		return imageAlt;
	}

	int displayOrder() {
		return displayOrder;
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
