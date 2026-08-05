package fr.lesroutesoubliees.routesoubliees.home;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
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
class AdminHomeAdministrationIntegrationTests {

	@Autowired
	private WebApplicationContext context;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void requiresAuthenticationForHomeAdministration() throws Exception {
		mvc.perform(get("/api/admin/home/messages"))
			.andExpect(status().isForbidden());
	}

	@Test
	void canCreateAndActivatePublishedHomeMessage() throws Exception {
		var created = mvc.perform(post("/api/admin/home/messages")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "title": "Parchemin admin",
					  "contentMarkdown": "Message **publie** depuis l'administration.\\n\\n- Premier signe\\n- Deuxieme signe\\n\\nVoir [le carnet](/notebook/QUEST_1).",
					  "importance": "SUCCESS",
					  "status": "PUBLISHED",
					  "countdownEnabled": false,
					  "endsAt": null,
					  "expiredMessage": null
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();

		var id = JsonTestSupport.extractString(created, "id");

		mvc.perform(post("/api/admin/home/messages/{id}/activate", id)
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));

		mvc.perform(get("/api/public/home"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message.title").value("Parchemin admin"))
			.andExpect(jsonPath("$.message.contentHtml").value(containsString("<strong>publie</strong>")))
			.andExpect(jsonPath("$.message.contentHtml").value(containsString("<ul><li>Premier signe</li><li>Deuxieme signe</li></ul>")))
			.andExpect(jsonPath("$.message.contentHtml").value(containsString("<a href=\"/notebook/QUEST_1\">le carnet</a>")));
	}

	@Test
	void canUpdateCompanyAndAdventurers() throws Exception {
		mvc.perform(put("/api/admin/group")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "Compagnie admin",
					  "emblemPath": null,
					  "imageAlt": null,
					  "shortDescription": "Description courte admin.",
					  "longDescriptionMarkdown": "Description **longue** admin.\\n\\n- Serment\\n- Boussole"
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Compagnie admin"));

		mvc.perform(post("/api/admin/adventurers")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "Aventurier admin",
					  "title": "Gardien",
					  "avatarPath": null,
					  "avatarAlt": null,
					  "shortDescription": "Visible depuis l'administration.",
					  "strengths": "Calme",
					  "weaknesses": "Prudence excessive",
					  "visible": true,
					  "displayOrder": 10
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.visible").value(true));

		mvc.perform(get("/api/admin/adventurers").with(user("admin@example.invalid").roles("ADMIN")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].name", hasItem("Aventurier admin")));

		mvc.perform(get("/api/public/home"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.company.name").value("Compagnie admin"))
			.andExpect(jsonPath("$.company.longDescriptionHtml").value(containsString("<strong>longue</strong>")))
			.andExpect(jsonPath("$.company.longDescriptionHtml").value(containsString("<ul><li>Serment</li><li>Boussole</li></ul>")));
	}
}
