package fr.lesroutesoubliees.routesoubliees.audit;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/audit-logs")
class AdminAuditController {

	private final AuditService audit;

	AdminAuditController(AuditService audit) {
		this.audit = audit;
	}

	@GetMapping
	List<AdminAuditLogResponse> listAuditLogs() {
		return audit.latest(50);
	}
}
