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

	Adventurer(
		UUID id,
		String name,
		String title,
		String avatarPath,
		String avatarAlt,
		String shortDescription,
		String strengths,
		String weaknesses,
		boolean visible,
		int displayOrder
	) {
		this.id = id;
		this.name = name;
		this.title = title;
		this.avatarPath = avatarPath;
		this.avatarAlt = avatarAlt;
		this.shortDescription = shortDescription;
		this.strengths = strengths;
		this.weaknesses = weaknesses;
		this.visible = visible;
		this.displayOrder = displayOrder;
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

	boolean visible() {
		return visible;
	}

	int displayOrder() {
		return displayOrder;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	OffsetDateTime updatedAt() {
		return updatedAt;
	}

	void update(
		String name,
		String title,
		String avatarPath,
		String avatarAlt,
		String shortDescription,
		String strengths,
		String weaknesses,
		boolean visible,
		int displayOrder
	) {
		this.name = name;
		this.title = title;
		this.avatarPath = avatarPath;
		this.avatarAlt = avatarAlt;
		this.shortDescription = shortDescription;
		this.strengths = strengths;
		this.weaknesses = weaknesses;
		this.visible = visible;
		this.displayOrder = displayOrder;
	}

	void changeDisplayOrder(int displayOrder) {
		this.displayOrder = displayOrder;
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
