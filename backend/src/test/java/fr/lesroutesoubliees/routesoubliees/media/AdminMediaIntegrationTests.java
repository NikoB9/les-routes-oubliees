package fr.lesroutesoubliees.routesoubliees.media;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;

// Ce test valide un comportement qui repose sur des ecritures COMMITEES lues via
// une requête JDBC brute (MediaService.isReferenced). @Transactional casserait cette
// verification (l'update JPA n'est pas flushe pour le JDBC brut) ; on isole donc la
// classe en recréant le contexte/la base après son exécution.
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminMediaIntegrationTests {

	private static final Path MEDIA_STORAGE = Path.of(
		System.getProperty("java.io.tmpdir"),
		"lro-media-tests-" + UUID.randomUUID());

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private ObjectMapper objectMapper;

	private MockMvc mvc;

	@DynamicPropertySource
	static void mediaProperties(DynamicPropertyRegistry registry) {
		registry.add("routes-oubliees.media-storage-path", () -> MEDIA_STORAGE.toString());
		registry.add("routes-oubliees.media-max-upload-bytes", () -> "1024");
	}

	@BeforeEach
	void setUp() throws Exception {
		Files.createDirectories(MEDIA_STORAGE);
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void requiresAuthenticationForAdminMediaList() throws Exception {
		mvc.perform(get("/api/admin/media"))
			.andExpect(status().isForbidden());
	}

	@Test
	void uploadsPngMediaWithoutMakingItPublic() throws Exception {
		var result = uploadPng("Embleme de test")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.originalFilename").value("emblem.png"))
			.andExpect(jsonPath("$.mimeType").value("image/png"))
			.andExpect(jsonPath("$.width").value(1))
			.andExpect(jsonPath("$.height").value(1))
			.andExpect(jsonPath("$.altText").value("Embleme de test"))
			.andReturn();

		var id = idFrom(result);
		mvc.perform(get("/media/" + id))
			.andExpect(status().isNotFound());
	}

	@Test
	void servesMediaReferencedByVisiblePublishedQuest() throws Exception {
		var result = uploadPng("Indice illustre").andExpect(status().isCreated()).andReturn();
		var id = idFrom(result);

		publishQuestWithMediaReference(id);

		mvc.perform(get("/media/" + id))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Type", containsString("image/png")))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"));
	}

	@Test
	void rejectsDisguisedSvgUpload() throws Exception {
		var svg = new MockMultipartFile(
			"file",
			"attack.png",
			"image/png",
			"<svg onload=\"alert(1)\"></svg>".getBytes());

		mvc.perform(multipart("/api/admin/media")
				.file(svg)
				.param("altText", "Image piegee")
				.with(user("admin@example.invalid"))
				.with(csrf()))
			.andExpect(status().isBadRequest());
	}

	@Test
	void refusesDeleteWhenQuestReferencesMedia() throws Exception {
		var result = uploadPng("Indice illustre").andExpect(status().isCreated()).andReturn();
		var id = idFrom(result);

		publishQuestWithMediaReference(id);

		mvc.perform(delete("/api/admin/media/" + id)
				.with(user("admin@example.invalid"))
				.with(csrf()))
			.andExpect(status().isConflict());
	}

	private org.springframework.test.web.servlet.ResultActions uploadPng(String altText) throws Exception {
		var png = new MockMultipartFile("file", "emblem.png", "image/png", onePixelPng());
		return mvc.perform(multipart("/api/admin/media")
			.file(png)
			.param("altText", altText)
			.with(user("admin@example.invalid"))
			.with(csrf()));
	}

	private void publishQuestWithMediaReference(String id) throws Exception {
		mvc.perform(put("/api/admin/quest-tabs/QUEST_1")
				.with(user("admin@example.invalid"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "title": "La piste du vieux pont",
					  "summary": "La Compagnie consigne un indice.",
					  "importantEventsMarkdown": "Un symbole apparait.",
					  "discoveredCluesMarkdown": "![Indice](/media/%s)",
					  "completedTrialsMarkdown": "- Observation",
					  "extraContentMarkdown": "A verifier.",
					  "adminDraftMarkdown": "",
					  "status": "PUBLISHED",
					  "visibleToPlayers": true
					}
					""".formatted(id)))
			.andExpect(status().isOk());
	}

	private String idFrom(MvcResult result) throws Exception {
		JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
		return node.get("id").asString();
	}

	private byte[] onePixelPng() {
		return Base64.getDecoder().decode(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=");
	}
}
