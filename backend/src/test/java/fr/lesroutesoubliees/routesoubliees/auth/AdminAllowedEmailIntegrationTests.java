package fr.lesroutesoubliees.routesoubliees.auth;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.empty;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class AdminAllowedEmailIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private AdminAllowedEmailRepository allowedEmails;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		allowedEmails.findAllByOrderByCreatedAtDesc().stream()
			.filter((email) -> email.email().startsWith("lot9-"))
			.forEach(allowedEmails::delete);
		if (allowedEmails.countByActiveTrue() == 0) {
			allowedEmails.save(new AdminAllowedEmail("admin@example.invalid", "Test admin"));
		}
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void requiresAuthenticationForAllowedEmailList() throws Exception {
		mvc.perform(get("/api/admin/allowed-emails"))
			.andExpect(status().isForbidden());
	}

	@Test
	void createsUpdatesAndListsAllowedEmails() throws Exception {
		var email = "Lot9-" + UUID.randomUUID() + "@example.invalid";

		var result = mvc.perform(post("/api/admin/allowed-emails")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "email": "%s",
					  "label": "Responsable"
					}
					""".formatted(email)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.email").value(email.toLowerCase()))
			.andExpect(jsonPath("$.active").value(true))
			.andReturn();

		var id = idFrom(result);

		mvc.perform(get("/api/admin/audit-logs").with(user("admin@example.invalid")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].action").value("ADMIN_ALLOWED_EMAIL_CREATED"))
			.andExpect(jsonPath("$[0].entityType").value("ADMIN_ALLOWED_EMAIL"))
			.andExpect(jsonPath("$[0].actorEmail").value("admin@example.invalid"));

		mvc.perform(put("/api/admin/allowed-emails/" + id)
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "label": "Responsable secondaire",
					  "active": false
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.label").value("Responsable secondaire"))
			.andExpect(jsonPath("$.active").value(false));

		mvc.perform(get("/api/admin/allowed-emails").with(user("admin@example.invalid")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", not(empty())));
	}

	@Test
	void refusesToDeactivateOrDeleteTheLastActiveAdministrator() throws Exception {
		allowedEmails.findAllByOrderByCreatedAtDesc().stream()
			.filter(AdminAllowedEmail::active)
			.skip(1)
			.forEach((email) -> {
				email.update(email.label(), false);
				allowedEmails.save(email);
			});
		var id = allowedEmails.findAllByOrderByCreatedAtDesc().stream()
			.filter(AdminAllowedEmail::active)
			.findFirst()
			.orElseThrow()
			.id();

		mvc.perform(put("/api/admin/allowed-emails/" + id)
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "label": "Bootstrap admin",
					  "active": false
					}
					"""))
			.andExpect(status().isConflict());

		mvc.perform(delete("/api/admin/allowed-emails/" + id)
				.with(user("admin@example.invalid"))
				.with(csrf()))
			.andExpect(status().isConflict());
	}

	@Test
	void exposesDashboardAndAuditOnlyToAdministrators() throws Exception {
		mvc.perform(get("/api/admin/dashboard"))
			.andExpect(status().isForbidden());

		mvc.perform(get("/api/admin/dashboard").with(user("admin@example.invalid")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.visibleQuestCount").exists())
			.andExpect(jsonPath("$.latestAuditLogs").isArray());

		mvc.perform(get("/api/admin/audit-logs").with(user("admin@example.invalid")))
			.andExpect(status().isOk());
	}

	private String idFrom(MvcResult result) throws Exception {
		JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
		return node.get("id").asString();
	}
}
