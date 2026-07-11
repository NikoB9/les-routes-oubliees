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

	boolean countdownEnabled() {
		return countdownEnabled;
	}

	OffsetDateTime endsAt() {
		return endsAt;
	}

	String expiredMessage() {
		return expiredMessage;
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
