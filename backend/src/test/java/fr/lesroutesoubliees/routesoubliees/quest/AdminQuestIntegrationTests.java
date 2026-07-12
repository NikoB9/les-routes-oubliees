package fr.lesroutesoubliees.routesoubliees.quest;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class AdminQuestIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void requiresAuthenticationForAdminQuestList() throws Exception {
		mvc.perform(get("/api/admin/quest-tabs"))
			.andExpect(status().isForbidden());
	}

	@Test
	void listsTheFiveFixedQuestTabsForAdministrators() throws Exception {
		mvc.perform(get("/api/admin/quest-tabs").with(user("admin@example.invalid")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(5)))
			.andExpect(jsonPath("$[0].code").value("QUEST_1"))
			.andExpect(jsonPath("$[4].code").value("VAL_D_AURELUNE"));
	}

	@Test
	void refusesWriteWithoutCsrfToken() throws Exception {
		mvc.perform(post("/api/admin/quest-tabs/QUEST_3/publish").with(user("admin@example.invalid")))
			.andExpect(status().isForbidden());
	}

	@Test
	void keepsDraftQuestHiddenEvenIfUpdateRequestsVisibility() throws Exception {
		mvc.perform(put("/api/admin/quest-tabs/QUEST_3")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "title": "Troisieme quete brouillon",
					  "summary": "Cette entree reste en brouillon.",
					  "importantEventsMarkdown": "<script>alert(1)</script>",
					  "discoveredCluesMarkdown": "[piege](javascript:alert(1))",
					  "completedTrialsMarkdown": "- Rien encore",
					  "extraContentMarkdown": "Notes internes publiques futures.",
					  "adminDraftMarkdown": "Secret admin",
					  "status": "DRAFT",
					  "visibleToPlayers": true
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("DRAFT"))
			.andExpect(jsonPath("$.visibleToPlayers").value(false))
			.andExpect(jsonPath("$.importantEventsHtml").value("<p>alert(1)</p>"))
			.andExpect(jsonPath("$.discoveredCluesHtml").value("<p>piege</p>"));

		mvc.perform(get("/api/public/quests/QUEST_3"))
			.andExpect(status().isNotFound());
	}

	@Test
	void canPublishThenHideAQuest() throws Exception {
		mvc.perform(post("/api/admin/quest-tabs/QUEST_3/publish")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"visibleToPlayers\":true}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andExpect(jsonPath("$.visibleToPlayers").value(true));

		mvc.perform(get("/api/public/quests/QUEST_3"))
			.andExpect(status().isOk());

		mvc.perform(post("/api/admin/quest-tabs/QUEST_3/hide")
				.with(user("admin@example.invalid"))
				.with(csrf()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.visibleToPlayers").value(false));

		mvc.perform(get("/api/public/quests/QUEST_3"))
			.andExpect(status().isNotFound());
	}
}
