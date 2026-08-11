package fr.lesroutesoubliees.routesoubliees.quest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import tools.jackson.databind.ObjectMapper;

/**
 * Documents d'organisation, de bout en bout.
 *
 * <p>Sans {@code @Transactional} : la suppression du fichier est enregistree pour l'apres-commit,
 * et une transaction de test annulee ne la declencherait jamais. Les assertions portent sur de
 * vraies ecritures, disque compris — d'ou l'isolation du contexte apres la classe, et le nettoyage
 * explicite avant chaque test, qui remplace l'annulation dont ces tests se privent.
 */
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminQuestDocumentIntegrationTests {

	private static final Path MEDIA_STORAGE = Path.of(
		System.getProperty("java.io.tmpdir"),
		"lro-quest-document-tests-" + UUID.randomUUID());

	private static final Path DOCUMENT_STORAGE = MEDIA_STORAGE.resolve("quests");

	/** Plafond volontairement minuscule : un depassement doit rester bon marche a fabriquer. */
	private static final long MAX_DOCUMENT_BYTES = 4096;

	private static final String ADMIN = "admin@example.invalid";

	private static final String PLAYER = "joueur@example.invalid";

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private QuestDocumentRepository documents;

	private MockMvc mvc;

	@DynamicPropertySource
	static void documentProperties(DynamicPropertyRegistry registry) {
		registry.add("routes-oubliees.media-storage-path", () -> MEDIA_STORAGE.toString());
		registry.add("routes-oubliees.quest-document-max-upload-bytes", () -> Long.toString(MAX_DOCUMENT_BYTES));
	}

	@BeforeEach
	void setUp() throws IOException {
		documents.deleteAll();
		Files.createDirectories(DOCUMENT_STORAGE);
		try (var stored = Files.list(DOCUMENT_STORAGE)) {
			stored.forEach(this::deleteQuietly);
		}
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void requiresAuthenticationForDocumentList() throws Exception {
		mvc.perform(get("/api/admin/quest-tabs/QUEST_1/documents"))
			.andExpect(status().isUnauthorized());
	}

	/**
	 * La garantie centrale du lot : un aventurier authentifie n'atteint aucune des quatre routes.
	 *
	 * <p>Le role {@code USER} est celui que Cloudflare Access attribue a toute identite valide.
	 * C'est exactement le profil d'un joueur pendant une partie.
	 */
	@Test
	void refusesAPlainUserOnEveryDocumentRoute() throws Exception {
		var player = user(PLAYER).roles("USER");
		var someId = UUID.randomUUID();

		mvc.perform(get("/api/admin/quest-tabs/QUEST_1/documents").with(player))
			.andExpect(status().isForbidden());
		mvc.perform(multipart("/api/admin/quest-tabs/QUEST_1/documents")
				.file(pdfPart())
				.param("label", "Feuille de route")
				.with(player)
				.with(csrf()))
			.andExpect(status().isForbidden());
		mvc.perform(get("/api/admin/quest-tabs/QUEST_1/documents/" + someId + "/content").with(player))
			.andExpect(status().isForbidden());
		mvc.perform(delete("/api/admin/quest-tabs/QUEST_1/documents/" + someId).with(player).with(csrf()))
			.andExpect(status().isForbidden());
	}

	@Test
	void refusesUploadWithoutCsrfToken() throws Exception {
		mvc.perform(multipart("/api/admin/quest-tabs/QUEST_1/documents")
				.file(pdfPart())
				.param("label", "Feuille de route")
				.with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isForbidden());
	}

	@Test
	void uploadsAPdfAndListsIt() throws Exception {
		upload("QUEST_1", "Feuille de route", pdfPart())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.label").value("Feuille de route"))
			.andExpect(jsonPath("$.originalFilename").value("organisation.pdf"))
			.andExpect(jsonPath("$.uploadedBy").value(ADMIN))
			.andExpect(jsonPath("$.contentUrl").value(startsWith("/api/admin/quest-tabs/QUEST_1/documents/")))
			.andExpect(jsonPath("$.relativePath").doesNotExist())
			.andExpect(jsonPath("$.storedFilename").doesNotExist());

		mvc.perform(get("/api/admin/quest-tabs/QUEST_1/documents").with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].label").value("Feuille de route"));
	}

	/** Le document appartient a sa quete : il ne doit pas apparaitre dans la liste d'une autre. */
	@Test
	void keepsTheListOfEachQuestSeparate() throws Exception {
		upload("QUEST_1", "Feuille de route", pdfPart()).andExpect(status().isCreated());

		mvc.perform(get("/api/admin/quest-tabs/QUEST_2/documents").with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	/** Valeurs assertees sans accent : la reponse est relue via l'encodage par defaut de MockMvc. */
	@Test
	void trimsTheLabelBeforeStoringIt() throws Exception {
		upload("QUEST_4", "   Consignes aux comediens   ", pdfPart())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.label").value("Consignes aux comediens"));
	}

	@Test
	void servesTheDocumentInlineAsPdf() throws Exception {
		var url = contentUrlOf(upload("QUEST_2", "Plan de secours", pdfPart()));

		mvc.perform(get(url).with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Type", "application/pdf"))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"))
			.andExpect(header().string("Content-Disposition", startsWith("inline")))
			.andExpect(header().string("Cache-Control", containsString("no-store")));
	}

	/** Un nom accentue doit survivre a l'en-tete, qui n'est pas en UTF-8 par defaut. */
	@Test
	void encodesAnAccentedFilenameInTheContentDisposition() throws Exception {
		var accented = new MockMultipartFile("file", "épreuves réalisées.pdf", "application/pdf", pdfBytes());
		var url = contentUrlOf(upload("QUEST_3", "Épreuves", accented));

		mvc.perform(get(url).with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Disposition", containsString("UTF-8''")));
	}

	@Test
	void rejectsANonPdfDisguisedAsPdf() throws Exception {
		var zip = new MockMultipartFile("file", "organisation.pdf", "application/pdf",
			new byte[] { 0x50, 0x4B, 0x03, 0x04, 0x00 });

		upload("QUEST_1", "Archive déguisée", zip)
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value(containsString("Signature PDF")));
	}

	@Test
	void rejectsAnUnsupportedMimeType() throws Exception {
		var png = new MockMultipartFile("file", "carte.png", "image/png", pdfBytes());

		upload("QUEST_1", "Carte", png)
			.andExpect(status().isUnsupportedMediaType());
	}

	@Test
	void rejectsAnEmptyFile() throws Exception {
		var empty = new MockMultipartFile("file", "vide.pdf", "application/pdf", new byte[0]);

		upload("QUEST_1", "Document vide", empty)
			.andExpect(status().isBadRequest());
	}

	@Test
	void rejectsAFileAboveTheDedicatedCeiling() throws Exception {
		var signature = pdfBytes();
		var oversized = new byte[(int) MAX_DOCUMENT_BYTES + 1];
		System.arraycopy(signature, 0, oversized, 0, signature.length);
		var file = new MockMultipartFile("file", "enorme.pdf", "application/pdf", oversized);

		upload("QUEST_1", "Dossier trop lourd", file)
			.andExpect(status().isPayloadTooLarge());
	}

	/**
	 * Un libelle vide doit rendre 400.
	 *
	 * <p>La validation appartient au service et non a une annotation : posee sur un controleur
	 * annote {@code @Validated}, elle passerait par le proxy de validation et sortirait en 500.
	 */
	@Test
	void rejectsABlankLabel() throws Exception {
		upload("QUEST_1", "   ", pdfPart())
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value(containsString("obligatoire")));
	}

	@Test
	void rejectsALabelThatIsTooLong() throws Exception {
		upload("QUEST_1", "x".repeat(161), pdfPart())
			.andExpect(status().isBadRequest());
	}

	/** Un refus ne doit rien laisser derriere lui sur le volume. */
	@Test
	void leavesNoFileBehindWhenTheUploadIsRejected() throws Exception {
		var zip = new MockMultipartFile("file", "organisation.pdf", "application/pdf",
			new byte[] { 0x50, 0x4B, 0x03, 0x04, 0x00 });

		upload("QUEST_1", "Archive déguisée", zip).andExpect(status().isBadRequest());

		try (var stored = Files.list(DOCUMENT_STORAGE)) {
			assertThat(stored).isEmpty();
		}
	}

	/** L'URL annonce une quete : elle ne doit pas servir le document d'une autre. */
	@Test
	void keepsDocumentsScopedToTheirQuest() throws Exception {
		var id = idOf(upload("QUEST_1", "Indices imprimables", pdfPart()));

		mvc.perform(get("/api/admin/quest-tabs/QUEST_2/documents/" + id + "/content")
				.with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isNotFound());
		mvc.perform(delete("/api/admin/quest-tabs/QUEST_2/documents/" + id)
				.with(user(ADMIN).roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isNotFound());
	}

	@Test
	void refusesAnUnknownQuestCode() throws Exception {
		mvc.perform(get("/api/admin/quest-tabs/QUEST_INCONNUE/documents").with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isNotFound());
	}

	@Test
	void listsDocumentsNewestFirst() throws Exception {
		upload("QUEST_1", "Premier depot", pdfPart()).andExpect(status().isCreated());
		upload("QUEST_1", "Second depot", pdfPart()).andExpect(status().isCreated());

		mvc.perform(get("/api/admin/quest-tabs/QUEST_1/documents").with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].label").value("Second depot"))
			.andExpect(jsonPath("$[1].label").value("Premier depot"));
	}

	@Test
	void deletesTheRowAndTheFile() throws Exception {
		var uploaded = upload("VAL_D_AURELUNE", "Dossier complet", pdfPart());
		var id = idOf(uploaded);
		var url = contentUrlOf(uploaded);
		try (var stored = Files.list(DOCUMENT_STORAGE)) {
			assertThat(stored).isNotEmpty();
		}

		mvc.perform(delete("/api/admin/quest-tabs/VAL_D_AURELUNE/documents/" + id)
				.with(user(ADMIN).roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isNoContent());

		mvc.perform(get(url).with(user(ADMIN).roles("ADMIN")))
			.andExpect(status().isNotFound());
		try (var stored = Files.list(DOCUMENT_STORAGE)) {
			assertThat(stored).isEmpty();
		}
	}

	/**
	 * Le document ne doit jamais transiter par la route des medias.
	 *
	 * <p>{@code /media/**} n'exige que {@code ROLE_USER} : si un document y etait servi, tout
	 * joueur authentifie pourrait le lire en connaissant son identifiant.
	 */
	@Test
	void neverExposesDocumentsThroughTheMediaRoute() throws Exception {
		var id = idOf(upload("QUEST_1", "Dossier confidentiel", pdfPart()));

		mvc.perform(get("/media/" + id).with(user(PLAYER).roles("USER")))
			.andExpect(status().isNotFound());
	}

	/**
	 * Deposer un document ne doit pas invalider le cache hors ligne des joueurs.
	 *
	 * <p>Epingle l'absence de {@code quest_documents} dans les tables suivies par
	 * {@code PublicContentVersionCalculator} : l'y ajouter ferait retelecharger tout le contenu
	 * public a chaque depot, pour un fichier que personne d'autre ne verra jamais.
	 */
	@Test
	void keepsTheOfflineContentVersionStableAcrossADocumentUpload() throws Exception {
		var before = contentVersion();

		upload("QUEST_2", "Notes d'organisation", pdfPart()).andExpect(status().isCreated());

		assertThat(contentVersion()).isEqualTo(before);
	}

	private String contentVersion() throws Exception {
		var body = mvc.perform(get("/api/public/content-version").with(user(PLAYER).roles("USER")))
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return objectMapper.readTree(body).get("version").asString();
	}

	private ResultActions upload(String questCode, String label, MockMultipartFile file) throws Exception {
		return mvc.perform(multipart("/api/admin/quest-tabs/" + questCode + "/documents")
			.file(file)
			.param("label", label)
			.with(user(ADMIN).roles("ADMIN"))
			.with(csrf()));
	}

	private MockMultipartFile pdfPart() {
		return new MockMultipartFile("file", "organisation.pdf", "application/pdf", pdfBytes());
	}

	/** Un PDF minimal : seule la signature de tete est verifiee a l'entree. */
	private byte[] pdfBytes() {
		return "%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n".getBytes(StandardCharsets.UTF_8);
	}

	private String idOf(ResultActions uploaded) throws Exception {
		return readUploaded(uploaded, "id");
	}

	private String contentUrlOf(ResultActions uploaded) throws Exception {
		return readUploaded(uploaded, "contentUrl");
	}

	private String readUploaded(ResultActions uploaded, String field) throws Exception {
		var body = uploaded.andReturn().getResponse().getContentAsString();
		return objectMapper.readTree(body).get(field).asString();
	}

	private void deleteQuietly(Path path) {
		try {
			Files.deleteIfExists(path);
		}
		catch (IOException ignored) {
		}
	}
}
