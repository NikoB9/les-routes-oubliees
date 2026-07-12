package fr.lesroutesoubliees.routesoubliees.audit;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuditService {

	private static final int MAX_SUMMARY_LENGTH = 500;

	private final AuditLogRepository auditLogs;

	AuditService(AuditLogRepository auditLogs) {
		this.auditLogs = auditLogs;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void record(String actorEmail, String action, String entityType, String entityId, String summary) {
		auditLogs.save(new AuditLog(
			normalize(actorEmail),
			normalizeRequired(action, "UNKNOWN_ACTION"),
			normalizeRequired(entityType, "UNKNOWN_ENTITY"),
			normalize(entityId),
			truncate(normalizeRequired(summary, "Action admin"))));
	}

	@Transactional(readOnly = true)
	public List<AdminAuditLogResponse> latest(int limit) {
		var pageSize = Math.max(1, Math.min(limit, 50));
		return auditLogs.findAllByOrderByCreatedAtDesc(PageRequest.of(0, pageSize)).stream()
			.map(AdminAuditLogResponse::from)
			.toList();
	}

	private String normalize(String value) {
		return StringUtils.hasText(value) ? value.trim() : null;
	}

	private String normalizeRequired(String value, String fallback) {
		return StringUtils.hasText(value) ? value.trim() : fallback;
	}

	private String truncate(String value) {
		return value.length() <= MAX_SUMMARY_LENGTH ? value : value.substring(0, MAX_SUMMARY_LENGTH);
	}
}
