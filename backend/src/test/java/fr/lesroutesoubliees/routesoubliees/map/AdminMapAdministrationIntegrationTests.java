package fr.lesroutesoubliees.routesoubliees.map;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.containsString;
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
import tools.jackson.databind.json.JsonMapper;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class AdminMapAdministrationIntegrationTests {

	private static final JsonMapper JSON = new JsonMapper();

	@Autowired
	private WebApplicationContext context;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void requiresAuthenticationForMapAdministration() throws Exception {
		mvc.perform(get("/api/admin/map-views"))
			.andExpect(status().isForbidden());
	}

	@Test
	void canCreatePreviewAndActivatePublishedMapVision() throws Exception {
		var created = mvc.perform(post("/api/admin/map-views")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "Carte finale admin",
					  "descriptionMarkdown": "Vision finale **preparee** en administration.\\n\\n- Val revele\\n- Route ouverte\\n\\n![carte](/assets/maps/map-final.png)",
					  "assetPath": "/assets/maps/map-final.png",
					  "imageAlt": "Carte finale de démonstration.",
					  "displayOrder": 42,
					  "status": "PUBLISHED"
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();

		var id = JSON.readTree(created).get("id").asString();

		mvc.perform(get("/api/admin/map-preview")
				.with(user("admin@example.invalid"))
				.param("visionId", id))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.vision.name").value("Carte finale admin"))
			.andExpect(jsonPath("$.markers", hasSize(5)));

		mvc.perform(post("/api/admin/map-views/{id}/activate", id)
				.with(user("admin@example.invalid"))
				.with(csrf()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));

		mvc.perform(get("/api/public/map"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.vision.name").value("Carte finale admin"))
			.andExpect(jsonPath("$.vision.descriptionHtml").value(containsString("<strong>preparee</strong>")))
			.andExpect(jsonPath("$.vision.descriptionHtml").value(containsString("<ul><li>Val revele</li><li>Route ouverte</li></ul>")))
			.andExpect(jsonPath("$.vision.descriptionHtml").value(containsString("<img src=\"/assets/maps/map-final.png\" alt=\"carte\">")));
	}

	@Test
	void refusesDraftActivationAndUnsafeMapAssetPath() throws Exception {
		mvc.perform(post("/api/admin/map-views/40000000-0000-0000-0000-000000000002/activate")
				.with(user("admin@example.invalid"))
				.with(csrf()))
			.andExpect(status().isBadRequest());

		mvc.perform(post("/api/admin/map-views")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "Chemin interdit",
					  "descriptionMarkdown": "Test.",
					  "assetPath": "https://example.invalid/map.png",
					  "imageAlt": "Asset interdit.",
					  "displayOrder": 43,
					  "status": "PUBLISHED"
					}
					"""))
			.andExpect(status().isBadRequest());
	}

	@Test
	void acceptsMediaLibraryImageAsMapBackground() throws Exception {
		mvc.perform(post("/api/admin/map-views")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "Carte médiathèque",
					  "descriptionMarkdown": "Vision issue d'un media uploade.",
					  "assetPath": "/media/70000000-0000-0000-0000-000000000001",
					  "imageAlt": "Carte importée depuis la médiathèque.",
					  "displayOrder": 44,
					  "status": "PUBLISHED"
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.assetPath").value("/media/70000000-0000-0000-0000-000000000001"))
			.andExpect(jsonPath("$.imageAlt").value("Carte importée depuis la médiathèque."));
	}

	@Test
	void canUpdateMarkerPositionAndHideItFromPublicMap() throws Exception {
		mvc.perform(put("/api/admin/map-markers/60000000-0000-0000-0000-000000000001")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "questCode": "QUEST_1",
					  "title": "Premier appel deplace",
					  "positionX": 12.500,
					  "positionY": 34.000,
					  "active": false,
					  "displayOrder": 1
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Premier appel deplace"))
			.andExpect(jsonPath("$.active").value(false));

		mvc.perform(get("/api/admin/map-markers").with(user("admin@example.invalid")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].title", hasItem("Premier appel deplace")));

		mvc.perform(get("/api/public/map"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.markers[*].title").value(hasItem("Chemin secondaire")));
	}
}
