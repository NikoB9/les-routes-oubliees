package fr.lesroutesoubliees.routesoubliees.audit;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_logs")
class AuditLog {

	@Id
	private UUID id;

	@Column(name = "actor_email", length = 320)
	private String actorEmail;

	@Column(nullable = false, length = 80)
	private String action;

	@Column(name = "entity_type", nullable = false, length = 80)
	private String entityType;

	@Column(name = "entity_id", length = 120)
	private String entityId;

	@Column(nullable = false, length = 500)
	private String summary;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	protected AuditLog() {
	}

	AuditLog(String actorEmail, String action, String entityType, String entityId, String summary) {
		this.id = UUID.randomUUID();
		this.actorEmail = actorEmail;
		this.action = action;
		this.entityType = entityType;
		this.entityId = entityId;
		this.summary = summary;
	}

	UUID id() {
		return id;
	}

	String actorEmail() {
		return actorEmail;
	}

	String action() {
		return action;
	}

	String entityType() {
		return entityType;
	}

	String entityId() {
		return entityId;
	}

	String summary() {
		return summary;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	@PrePersist
	void prePersist() {
		createdAt = OffsetDateTime.now(ZoneOffset.UTC);
	}
}
