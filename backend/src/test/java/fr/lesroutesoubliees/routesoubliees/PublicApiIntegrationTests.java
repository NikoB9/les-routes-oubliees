package fr.lesroutesoubliees.routesoubliees;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
class PublicApiIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).build();
	}

	@Test
	void exposesOnlyPublicHomeContent() throws Exception {
		mvc.perform(get("/api/public/home"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message.title").value("Message de demonstration"))
			.andExpect(jsonPath("$.message.displayTimezone").value("Europe/Paris"))
			.andExpect(jsonPath("$.company.name").value("Compagnie de demonstration"))
			.andExpect(jsonPath("$.adventurers", hasSize(2)))
			.andExpect(jsonPath("$.adventurers[0].name").value("Aline des Brumes"))
			.andExpect(jsonPath("$.adventurers[1].name").value("Malo Fer-de-Clef"));
	}

	@Test
	void exposesOnlyActivePublishedMapVision() throws Exception {
		mvc.perform(get("/api/public/map"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.vision.name").value("Carte voilee"))
			.andExpect(jsonPath("$.vision.assetPath").value("/assets/maps/map-hidden.png"))
			.andExpect(jsonPath("$.markers", hasSize(2)))
			.andExpect(jsonPath("$.markers[0].title").value("Premier appel"))
			.andExpect(jsonPath("$.markers[0].questCode").value("QUEST_1"))
			.andExpect(jsonPath("$.markers[0].positionX").value(31.500))
			.andExpect(jsonPath("$.markers[0].positionY").value(70.000))
			.andExpect(jsonPath("$.markers[1].title").value("Chemin secondaire"))
			.andExpect(jsonPath("$.markers[1].questCode").value("QUEST_2"))
			.andExpect(jsonPath("$.markers[?(@.questCode == 'QUEST_3')]").isEmpty())
			.andExpect(jsonPath("$.markers[?(@.questCode == 'QUEST_4')]").isEmpty())
			.andExpect(jsonPath("$.markers[?(@.questCode == 'VAL_D_AURELUNE')]").isEmpty())
			.andExpect(jsonPath("$.markers[0].status").doesNotExist())
			.andExpect(jsonPath("$.markers[0].createdAt").doesNotExist());
	}

	@Test
	void exposesOnlyPublishedAndVisibleQuests() throws Exception {
		mvc.perform(get("/api/public/quests"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].code").value("QUEST_1"))
			.andExpect(jsonPath("$[1].code").value("QUEST_2"));

		mvc.perform(get("/api/public/notebook"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)));
	}

	@Test
	void rejectsDraftHiddenAndArchivedQuestDetails() throws Exception {
		mvc.perform(get("/api/public/quests/QUEST_1"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Premiere quete de demonstration"))
			.andExpect(jsonPath("$.importantEventsHtml").exists())
			.andExpect(jsonPath("$.adminDraftMarkdown").doesNotExist())
			.andExpect(jsonPath("$.adminDraftHtml").doesNotExist());

		mvc.perform(get("/api/public/quests/QUEST_3"))
			.andExpect(status().isNotFound());

		mvc.perform(get("/api/public/quests/QUEST_4"))
			.andExpect(status().isNotFound());

		mvc.perform(get("/api/public/quests/VAL_D_AURELUNE"))
			.andExpect(status().isNotFound());
	}
}
