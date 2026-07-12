package fr.lesroutesoubliees.routesoubliees.media;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "media_assets")
class MediaAsset {

	@Id
	private UUID id;

	@Column(name = "original_filename", nullable = false)
	private String originalFilename;

	@Column(name = "stored_filename", nullable = false, unique = true, length = 120)
	private String storedFilename;

	@Column(name = "relative_path", nullable = false, unique = true)
	private String relativePath;

	@Column(name = "mime_type", nullable = false, length = 40)
	private String mimeType;

	@Column(name = "size_bytes", nullable = false)
	private long sizeBytes;

	@Column(nullable = false)
	private int width;

	@Column(nullable = false)
	private int height;

	@Column(name = "alt_text", nullable = false, length = 280)
	private String altText;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "created_by", length = 320)
	private String createdBy;

	protected MediaAsset() {
	}

	MediaAsset(
		UUID id,
		String originalFilename,
		String storedFilename,
		String relativePath,
		String mimeType,
		long sizeBytes,
		int width,
		int height,
		String altText,
		String createdBy
	) {
		this.id = id;
		this.originalFilename = originalFilename;
		this.storedFilename = storedFilename;
		this.relativePath = relativePath;
		this.mimeType = mimeType;
		this.sizeBytes = sizeBytes;
		this.width = width;
		this.height = height;
		this.altText = altText;
		this.createdBy = createdBy;
	}

	UUID id() {
		return id;
	}

	String originalFilename() {
		return originalFilename;
	}

	String storedFilename() {
		return storedFilename;
	}

	String relativePath() {
		return relativePath;
	}

	String mimeType() {
		return mimeType;
	}

	long sizeBytes() {
		return sizeBytes;
	}

	int width() {
		return width;
	}

	int height() {
		return height;
	}

	String altText() {
		return altText;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	String createdBy() {
		return createdBy;
	}

	@PrePersist
	void prePersist() {
		createdAt = OffsetDateTime.now(ZoneOffset.UTC);
	}
}
