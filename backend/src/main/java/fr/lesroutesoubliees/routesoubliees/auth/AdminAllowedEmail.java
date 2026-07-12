package fr.lesroutesoubliees.routesoubliees.auth;

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
@Table(name = "admin_allowed_emails")
class AdminAllowedEmail {

	@Id
	private UUID id;

	@Column(nullable = false, length = 320, unique = true)
	private String email;

	@Column(length = 120)
	private String label;

	@Column(nullable = false)
	private boolean active;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected AdminAllowedEmail() {
	}

	AdminAllowedEmail(String email, String label) {
		this.id = UUID.randomUUID();
		this.email = email;
		this.label = label;
		this.active = true;
	}

	UUID id() {
		return id;
	}

	String email() {
		return email;
	}

	String label() {
		return label;
	}

	boolean active() {
		return active;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	OffsetDateTime updatedAt() {
		return updatedAt;
	}

	void update(String label, boolean active) {
		this.label = label;
		this.active = active;
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
