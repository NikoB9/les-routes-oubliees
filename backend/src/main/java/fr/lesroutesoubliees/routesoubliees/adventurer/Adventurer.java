package fr.lesroutesoubliees.routesoubliees.adventurer;

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
@Table(name = "adventurers")
class Adventurer {

	@Id
	private UUID id;

	@Column(nullable = false, length = 160)
	private String name;

	@Column(nullable = false, length = 160)
	private String title;

	@Column(name = "avatar_path")
	private String avatarPath;

	@Column(name = "avatar_alt", length = 280)
	private String avatarAlt;

	@Column(name = "short_description", nullable = false, length = 500)
	private String shortDescription;

	@Column(nullable = false)
	private String strengths;

	@Column(nullable = false)
	private String weaknesses;

	@Column(nullable = false)
	private boolean visible;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected Adventurer() {
	}

	UUID id() {
		return id;
	}

	String name() {
		return name;
	}

	String title() {
		return title;
	}

	String avatarPath() {
		return avatarPath;
	}

	String avatarAlt() {
		return avatarAlt;
	}

	String shortDescription() {
		return shortDescription;
	}

	String strengths() {
		return strengths;
	}

	String weaknesses() {
		return weaknesses;
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
