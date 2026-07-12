package fr.lesroutesoubliees.routesoubliees.quest;

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
@Table(name = "quests")
class Quest {

	@Id
	private UUID id;

	@Column(nullable = false, length = 40, unique = true)
	private String code;

	@Column(nullable = false, length = 160)
	private String title;

	@Column(nullable = false, length = 700)
	private String summary;

	@Column(name = "important_events_markdown", nullable = false)
	private String importantEventsMarkdown;

	@Column(name = "discovered_clues_markdown", nullable = false)
	private String discoveredCluesMarkdown;

	@Column(name = "completed_trials_markdown", nullable = false)
	private String completedTrialsMarkdown;

	@Column(name = "extra_content_markdown", nullable = false)
	private String extraContentMarkdown;

	@Column(name = "admin_draft_markdown", nullable = false)
	private String adminDraftMarkdown;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private EditorialStatus status;

	@Column(name = "visible_to_players", nullable = false)
	private boolean visibleToPlayers;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected Quest() {
	}

	UUID id() {
		return id;
	}

	String code() {
		return code;
	}

	String title() {
		return title;
	}

	String summary() {
		return summary;
	}

	String importantEventsMarkdown() {
		return importantEventsMarkdown;
	}

	String discoveredCluesMarkdown() {
		return discoveredCluesMarkdown;
	}

	String completedTrialsMarkdown() {
		return completedTrialsMarkdown;
	}

	String extraContentMarkdown() {
		return extraContentMarkdown;
	}

	String adminDraftMarkdown() {
		return adminDraftMarkdown;
	}

	EditorialStatus status() {
		return status;
	}

	boolean visibleToPlayers() {
		return visibleToPlayers;
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
		String title,
		String summary,
		String importantEventsMarkdown,
		String discoveredCluesMarkdown,
		String completedTrialsMarkdown,
		String extraContentMarkdown,
		String adminDraftMarkdown,
		EditorialStatus status,
		boolean visibleToPlayers
	) {
		this.title = title;
		this.summary = summary;
		this.importantEventsMarkdown = importantEventsMarkdown;
		this.discoveredCluesMarkdown = discoveredCluesMarkdown;
		this.completedTrialsMarkdown = completedTrialsMarkdown;
		this.extraContentMarkdown = extraContentMarkdown;
		this.adminDraftMarkdown = adminDraftMarkdown;
		this.status = status;
		this.visibleToPlayers = visibleToPlayers && status == EditorialStatus.PUBLISHED;
	}

	void publish(boolean visibleToPlayers) {
		status = EditorialStatus.PUBLISHED;
		this.visibleToPlayers = visibleToPlayers;
	}

	void hide() {
		visibleToPlayers = false;
	}

	void archive() {
		status = EditorialStatus.ARCHIVED;
		visibleToPlayers = false;
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
