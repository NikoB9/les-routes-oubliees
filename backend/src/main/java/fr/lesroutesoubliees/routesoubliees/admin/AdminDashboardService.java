package fr.lesroutesoubliees.routesoubliees.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
class AdminDashboardService {

	private final JdbcTemplate jdbc;
	private final AuditService audit;

	AdminDashboardService(JdbcTemplate jdbc, AuditService audit) {
		this.jdbc = jdbc;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	AdminDashboardResponse dashboard() {
		return new AdminDashboardResponse(
			optionalString("select title from home_messages where active = true limit 1"),
			optionalString("select name from map_visions where active = true limit 1"),
			optionalString("select name from company_profiles where active = true limit 1"),
			count("select count(*) from adventurers where visible = true"),
			count("select count(*) from quests where status = 'PUBLISHED' and visible_to_players = true"),
			count("select count(*) from media_assets"),
			count("select count(*) from admin_allowed_emails where active = true"),
			audit.latest(5));
	}

	private String optionalString(String sql) {
		var values = jdbc.query(sql, (rs, rowNum) -> rs.getString(1));
		return values.isEmpty() ? null : values.getFirst();
	}

	private long count(String sql) {
		var value = jdbc.queryForObject(sql, Long.class);
		return value == null ? 0 : value;
	}
}
