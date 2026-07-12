package fr.lesroutesoubliees.routesoubliees.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
class AdminDashboardController {

	private final AdminDashboardService dashboard;

	AdminDashboardController(AdminDashboardService dashboard) {
		this.dashboard = dashboard;
	}

	@GetMapping
	AdminDashboardResponse dashboard() {
		return dashboard.dashboard();
	}
}
