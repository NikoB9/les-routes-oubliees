package fr.lesroutesoubliees.routesoubliees.quest;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Document d'organisation tel qu'il est expose a l'administration.
 *
 * <p>Ni {@code relativePath} ni {@code storedFilename} n'y figurent : ce sont des chemins
 * systeme, et rien dans l'interface n'en a besoin puisque le telechargement passe par
 * {@code contentUrl}.
 */
record AdminQuestDocumentResponse(
	UUID id,
	String label,
	String originalFilename,
	long sizeBytes,
	String contentUrl,
	OffsetDateTime createdAt,
	String uploadedBy
) {

	static AdminQuestDocumentResponse from(String questCode, QuestDocument document) {
		return new AdminQuestDocumentResponse(
			document.id(),
			document.label(),
			document.originalFilename(),
			document.sizeBytes(),
			"/api/admin/quest-tabs/" + questCode + "/documents/" + document.id() + "/content",
			document.createdAt(),
			document.uploadedBy());
	}
}
