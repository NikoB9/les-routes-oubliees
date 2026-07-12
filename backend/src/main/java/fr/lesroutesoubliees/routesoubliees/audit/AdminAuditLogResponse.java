package fr.lesroutesoubliees.routesoubliees.audit;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminAuditLogResponse(
	UUID id,
	String actorEmail,
	String action,
	String entityType,
	String entityId,
	String summary,
	OffsetDateTime createdAt
) {

	static AdminAuditLogResponse from(AuditLog log) {
		return new AdminAuditLogResponse(
			log.id(),
			log.actorEmail(),
			log.action(),
			log.entityType(),
			log.entityId(),
			log.summary(),
			log.createdAt());
	}
}
