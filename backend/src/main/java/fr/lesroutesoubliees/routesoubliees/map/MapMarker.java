package fr.lesroutesoubliees.routesoubliees.map;

import java.math.BigDecimal;
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
@Table(name = "map_markers")
class MapMarker {

	@Id
	private UUID id;

	@Column(name = "quest_id", nullable = false)
	private UUID questId;

	@Column(nullable = false, length = 160)
	private String title;

	@Column(name = "position_x", nullable = false, precision = 6, scale = 3)
	private BigDecimal positionX;

	@Column(name = "position_y", nullable = false, precision = 6, scale = 3)
	private BigDecimal positionY;

	@Column(nullable = false)
	private boolean active;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected MapMarker() {
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
