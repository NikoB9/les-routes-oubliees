package fr.lesroutesoubliees.routesoubliees.home;

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
@Table(name = "home_messages")
class HomeMessage {

	@Id
	private UUID id;

	@Column(nullable = false, length = 160)
	private String title;

	@Column(name = "content_markdown", nullable = false)
	private String contentMarkdown;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private HomeMessageImportance importance;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private EditorialStatus status;

	@Column(nullable = false)
	private boolean active;

	@Column(name = "countdown_enabled", nullable = false)
	private boolean countdownEnabled;

	@Column(name = "ends_at")
	private OffsetDateTime endsAt;

	@Column(name = "expired_message", length = 280)
	private String expiredMessage;

	@Column(name = "last_modified_by", length = 320)
	private String lastModifiedBy;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected HomeMessage() {
	}

	HomeMessage(
		UUID id,
		String title,
		String contentMarkdown,
		HomeMessageImportance importance,
		EditorialStatus status,
		boolean active,
		boolean countdownEnabled,
		OffsetDateTime endsAt,
		String expiredMessage,
		String lastModifiedBy
	) {
		this.id = id;
		this.title = title;
		this.contentMarkdown = contentMarkdown;
		this.importance = importance;
		this.status = status;
		this.active = active && status == EditorialStatus.PUBLISHED;
		this.countdownEnabled = countdownEnabled;
		this.endsAt = countdownEnabled ? endsAt : null;
		this.expiredMessage = expiredMessage;
		this.lastModifiedBy = lastModifiedBy;
	}

	UUID id() {
		return id;
	}

	String title() {
		return title;
	}

	String contentMarkdown() {
		return contentMarkdown;
	}

	HomeMessageImportance importance() {
		return importance;
	}

	EditorialStatus status() {
		return status;
	}

	boolean active() {
		return active;
	}

	boolean countdownEnabled() {
		return countdownEnabled;
	}

	OffsetDateTime endsAt() {
		return endsAt;
	}

	String expiredMessage() {
		return expiredMessage;
	}

	String lastModifiedBy() {
		return lastModifiedBy;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	OffsetDateTime updatedAt() {
		return updatedAt;
	}

	void update(
		String title,
		String contentMarkdown,
		HomeMessageImportance importance,
		EditorialStatus status,
		boolean countdownEnabled,
		OffsetDateTime endsAt,
		String expiredMessage,
		String actorEmail
	) {
		this.title = title;
		this.contentMarkdown = contentMarkdown;
		this.importance = importance;
		this.status = status;
		this.countdownEnabled = countdownEnabled;
		this.endsAt = countdownEnabled ? endsAt : null;
		this.expiredMessage = expiredMessage;
		this.lastModifiedBy = actorEmail;
		if (status != EditorialStatus.PUBLISHED) {
			active = false;
		}
	}

	void activate(String actorEmail) {
		if (status != EditorialStatus.PUBLISHED) {
			throw new IllegalStateException("Only a published home message can be active");
		}
		active = true;
		lastModifiedBy = actorEmail;
	}

	void deactivate() {
		active = false;
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
