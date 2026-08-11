package fr.lesroutesoubliees.routesoubliees.quest;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Document d'organisation rattache a une quete.
 *
 * <p>La quete est portee par son identifiant seul, sans {@code @ManyToOne} : la relation n'est
 * jamais parcourue depuis le document, et un chargement paresseux ne servirait qu'a exposer
 * {@link Quest}, qui reste volontairement confine a son package.
 *
 * <p>Chaque {@code length} est declare explicitement. Hibernate demarre en {@code validate} :
 * une longueur laissee au defaut ferait attendre {@code varchar(255)} et empecherait le
 * contexte de se lever, tests compris.
 */
@Entity
@Table(name = "quest_documents")
class QuestDocument {

	@Id
	private UUID id;

	@Column(name = "quest_id", nullable = false)
	private UUID questId;

	@Column(nullable = false, length = 160)
	private String label;

	@Column(name = "original_filename", nullable = false, length = 255)
	private String originalFilename;

	@Column(name = "stored_filename", nullable = false, unique = true, length = 120)
	private String storedFilename;

	@Column(name = "relative_path", nullable = false, unique = true, length = 255)
	private String relativePath;

	@Column(name = "mime_type", nullable = false, length = 64)
	private String mimeType;

	@Column(name = "size_bytes", nullable = false)
	private long sizeBytes;

	@Column(name = "uploaded_by", length = 320)
	private String uploadedBy;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	protected QuestDocument() {
	}

	QuestDocument(
		UUID id,
		UUID questId,
		String label,
		String originalFilename,
		String storedFilename,
		String relativePath,
		String mimeType,
		long sizeBytes,
		String uploadedBy
	) {
		this.id = id;
		this.questId = questId;
		this.label = label;
		this.originalFilename = originalFilename;
		this.storedFilename = storedFilename;
		this.relativePath = relativePath;
		this.mimeType = mimeType;
		this.sizeBytes = sizeBytes;
		this.uploadedBy = uploadedBy;
	}

	UUID id() {
		return id;
	}

	UUID questId() {
		return questId;
	}

	String label() {
		return label;
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

	String uploadedBy() {
		return uploadedBy;
	}

	OffsetDateTime createdAt() {
		return createdAt;
	}

	@PrePersist
	void prePersist() {
		createdAt = OffsetDateTime.now(ZoneOffset.UTC);
	}
}
