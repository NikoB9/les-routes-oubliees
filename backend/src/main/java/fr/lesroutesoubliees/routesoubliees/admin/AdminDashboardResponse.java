package fr.lesroutesoubliees.routesoubliees.admin;

import java.util.List;

import fr.lesroutesoubliees.routesoubliees.audit.AdminAuditLogResponse;

public record AdminDashboardResponse(
	String activeHomeMessageTitle,
	String activeMapVisionName,
	String activeCompanyName,
	long visibleAdventurerCount,
	long visibleQuestCount,
	long mediaCount,
	long activeAdministratorCount,
	List<AdminAuditLogResponse> latestAuditLogs
) {
}
