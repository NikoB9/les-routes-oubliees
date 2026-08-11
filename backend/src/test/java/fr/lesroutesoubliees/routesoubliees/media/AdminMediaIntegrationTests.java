package fr.lesroutesoubliees.routesoubliees.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.UUID;
import java.util.zip.CRC32;

import jakarta.servlet.MultipartConfigElement;

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

	@Autowired
	private MultipartConfigElement multipartConfig;

	private MockMvc mvc;

	@DynamicPropertySource
	static void mediaProperties(DynamicPropertyRegistry registry) {
		registry.add("routes-oubliees.media-storage-path", () -> MEDIA_STORAGE.toString());
		registry.add("routes-oubliees.media-max-upload-bytes", () -> "1024");
		registry.add("routes-oubliees.quest-document-max-upload-bytes", () -> "2048");
	}

	@BeforeEach
	void setUp() throws Exception {
		Files.createDirectories(MEDIA_STORAGE);
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	/**
	 * Le plafond du conteneur servlet doit suivre les plafonds applicatifs.
	 *
	 * <p>Laisse au defaut de Spring Boot, il valait 1 Mio quel que soit
	 * {@code media-max-upload-bytes} : le conteneur rejetait pendant l'analyse du multipart et
	 * la valeur configuree n'avait aucun effet au-dela. L'ecart etait invisible en test,
	 * {@code MockMvc} n'appliquant pas les limites du conteneur — d'ou cette verification sur
	 * la configuration elle-meme plutot que sur une requete.
	 *
	 * <p>Le conteneur n'a qu'un reglage pour deux plafonds applicatifs : c'est le plus permissif
	 * qui doit passer, sans quoi le controle applicatif du plus large — ici les documents
	 * d'organisation, a 2048 octets — resterait hors d'atteinte. Les valeurs sont volontairement
	 * differentes pour que le test distingue un maximum d'un minimum.
	 */
	@Test
	void alignsTheServletUploadCeilingWithTheWidestApplicationCeiling() {
		assertThat(multipartConfig.getMaxFileSize()).isEqualTo(2048);
		assertThat(multipartConfig.getMaxRequestSize())
			.isEqualTo(2048 + UploadCeilingConfiguration.MULTIPART_OVERHEAD_BYTES);
	}

	@Test
	void requiresAuthenticationForAdminMediaList() throws Exception {
		mvc.perform(get("/api/admin/media"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void requiresCloudflareIdentityForMediaDelivery() throws Exception {
		var result = uploadPng("Indice illustre").andExpect(status().isCreated()).andReturn();
		var id = idFrom(result);
		publishQuestWithMediaReference(id);

		mvc.perform(get("/media/" + id))
			.andExpect(status().isUnauthorized());
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
		mvc.perform(get("/media/" + id).with(user("aventurier@example.invalid").roles("USER")))
			.andExpect(status().isNotFound());
	}

	@Test
	void servesMediaReferencedByVisiblePublishedQuest() throws Exception {
		var result = uploadPng("Indice illustre").andExpect(status().isCreated()).andReturn();
		var id = idFrom(result);

		publishQuestWithMediaReference(id);

		mvc.perform(get("/media/" + id).with(user("aventurier@example.invalid").roles("USER")))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Type", containsString("image/png")))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"));
	}

	/**
	 * Bombe de decompression : un PNG de quelques dizaines d'octets peut annoncer une surface
	 * de plusieurs centaines de millions de pixels. Tant que les dimensions etaient obtenues
	 * par un decodage complet, ce fichier reclamait plusieurs gibioctets et emportait la JVM,
	 * donc le Radar en pleine partie.
	 *
	 * <p>Le test construit l'en-tete plutot que l'image : allouer reellement la trame
	 * reviendrait a reproduire la panne dans la suite de tests.
	 */
	@Test
	void rejectsAnImageDeclaringAnAbsurdSurface() throws Exception {
		var bomb = new MockMultipartFile(
			"file",
			"bombe.png",
			"image/png",
			pngDeclaringSize(30_000, 30_000));

		mvc.perform(multipart("/api/admin/media")
				.file(bomb)
				.param("altText", "Carte demesuree")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isBadRequest());
	}

	/**
	 * Dimensions d'un WebP sans perte.
	 *
	 * <p>La hauteur etait lue par un decalage errone qui laissait de surcroit les bits alpha et
	 * version deborder dedans : elle etait fausse pour toute image, y compris 1x1. Sans
	 * consequence tant que rien ne s'en servait, la valeur n'etant qu'un affichage dans la
	 * mediatheque — mais le plafond de surface s'appuie desormais dessus, et une hauteur
	 * sur-evaluee faisait refuser des images parfaitement legitimes.
	 */
	@Test
	void readsLosslessWebpDimensions() throws Exception {
		var webp = new MockMultipartFile("file", "carte.webp", "image/webp", losslessWebp(4096, 4096));

		mvc.perform(multipart("/api/admin/media")
				.file(webp)
				.param("altText", "Carte sans perte")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.width").value(4096))
			.andExpect(jsonPath("$.height").value(4096));
	}

	/**
	 * Le chemin WebP avec perte lit un champ de quatorze bits sans verifier le code de
	 * demarrage du bloc : un fichier forge y annonce {@code 0 x 0}. PNG et JPEG refusaient deja
	 * les dimensions nulles, WebP non — l'image aurait ete stockee puis servie.
	 */
	@Test
	void rejectsAWebpDeclaringNoSurface() throws Exception {
		var empty = new MockMultipartFile("file", "vide.webp", "image/webp", webpChunk("VP8 "));

		mvc.perform(multipart("/api/admin/media")
				.file(empty)
				.param("altText", "Image sans surface")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isBadRequest());
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
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isBadRequest());
	}

	@Test
	void refusesDeleteWhenQuestReferencesMedia() throws Exception {
		var result = uploadPng("Indice illustre").andExpect(status().isCreated()).andReturn();
		var id = idFrom(result);

		publishQuestWithMediaReference(id);

		mvc.perform(delete("/api/admin/media/" + id)
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isConflict());
	}

	/**
	 * Le logo du site est un media par conception : {@code SiteSettingsService.isSafeLogoPath}
	 * autorise explicitement la forme {@code /media/{uuid}}. Le garde-fou de suppression
	 * n'interrogeait pourtant pas {@code site_settings}, et detruisait ligne et fichier sur un
	 * simple 204 — le logo disparaissait alors de toutes les pages, sans recours.
	 */
	@Test
	void refusesDeleteWhenTheSiteLogoUsesTheMedia() throws Exception {
		var id = idFrom(uploadPng("Logo de la Compagnie").andExpect(status().isCreated()).andReturn());

		useMediaAsSiteLogo(id);

		mvc.perform(delete("/api/admin/media/" + id)
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isConflict());
		// Meme liste pour les deux questions : le logo etant public, le media l'est aussi.
		mvc.perform(get("/media/" + id).with(user("aventurier@example.invalid").roles("USER")))
			.andExpect(status().isOk());
	}

	/**
	 * Une vision de carte en brouillon retient son image sans la publier. C'est la forme la plus
	 * nette du defaut : le garde-fou de suppression doit ignorer la visibilite, la ou celui de
	 * diffusion l'applique. L'image de la carte revelee etant l'artefact central du jeu, sa
	 * destruction n'est pas rattrapable.
	 */
	@Test
	void refusesDeleteWhenADraftMapVisionUsesTheMedia() throws Exception {
		var id = idFrom(uploadPng("Carte revelee").andExpect(status().isCreated()).andReturn());

		useMediaAsDraftMapVision(id);

		mvc.perform(delete("/api/admin/media/" + id)
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf()))
			.andExpect(status().isConflict());
		mvc.perform(get("/media/" + id).with(user("aventurier@example.invalid").roles("USER")))
			.andExpect(status().isNotFound());
	}

	private void useMediaAsSiteLogo(String id) throws Exception {
		mvc.perform(put("/api/admin/settings")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "siteName": "Les Routes Oubliées",
					  "subtitle": "Compagnie d'Arkhavel",
					  "logoPath": "/media/%s",
					  "timezone": "Europe/Paris",
					  "status": "ONLINE",
					  "maintenanceMessage": null,
					  "accessibilityInformationMarkdown": "Informations d'accessibilité."
					}
					""".formatted(id)))
			.andExpect(status().isOk());
	}

	private void useMediaAsDraftMapVision(String id) throws Exception {
		mvc.perform(post("/api/admin/map-views")
				.with(user("admin@example.invalid").roles("ADMIN"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "Carte révélée",
					  "descriptionMarkdown": "La carte complète.",
					  "assetPath": "/media/%s",
					  "imageAlt": "Carte révélée du domaine.",
					  "displayOrder": 9,
					  "status": "DRAFT"
					}
					""".formatted(id)))
			.andExpect(status().is2xxSuccessful());
	}

	private org.springframework.test.web.servlet.ResultActions uploadPng(String altText) throws Exception {
		var png = new MockMultipartFile("file", "emblem.png", "image/png", onePixelPng());
		return mvc.perform(multipart("/api/admin/media")
			.file(png)
			.param("altText", altText)
			.with(user("admin@example.invalid").roles("ADMIN"))
			.with(csrf()));
	}

	private void publishQuestWithMediaReference(String id) throws Exception {
		mvc.perform(put("/api/admin/quest-tabs/QUEST_1")
				.with(user("admin@example.invalid").roles("ADMIN"))
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

	/**
	 * En-tete WebP sans perte declarant des dimensions donnees.
	 *
	 * <p>Les bits sont poses selon la specification VP8L — flux petit-boutiste, 14 bits de
	 * largeur moins un, 14 bits de hauteur moins un, un bit alpha, trois bits de version — afin
	 * que le test derive de la specification et non de l'implementation qu'il verifie.
	 *
	 * <p>Seul l'en-tete est renseigne : la validation ne decode jamais l'image.
	 */
	private byte[] losslessWebp(int width, int height) {
		var header = new byte[4];
		var bit = 0;
		for (var value : new int[][] { { width - 1, 14 }, { height - 1, 14 }, { 1, 1 }, { 0, 3 } }) {
			for (var index = 0; index < value[1]; index++, bit++) {
				header[bit >> 3] |= (byte) (((value[0] >> index) & 1) << (bit & 7));
			}
		}

		var webp = webpChunk("VP8L");
		webp[20] = 0x2F;
		System.arraycopy(header, 0, webp, 21, 4);
		return webp;
	}

	/**
	 * Enveloppe RIFF minimale portant un identifiant de bloc donne.
	 *
	 * <p>Trente octets : la taille minimale que la validation exige, et de quoi loger les
	 * champs de dimensions de chaque variante. Ceux-ci restent a zero tant que l'appelant ne
	 * les renseigne pas.
	 */
	private byte[] webpChunk(String fourcc) {
		var webp = new byte[30];
		System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, webp, 0, 4);
		System.arraycopy("WEBP".getBytes(StandardCharsets.US_ASCII), 0, webp, 8, 4);
		System.arraycopy(fourcc.getBytes(StandardCharsets.US_ASCII), 0, webp, 12, 4);
		return webp;
	}

	/**
	 * Reecrit les dimensions dans l'IHDR d'un PNG valide, et recalcule son CRC.
	 *
	 * <p>Sans CRC coherent, le lecteur rejetterait l'en-tete pour une toute autre raison que
	 * celle testee, et le test passerait au vert sans rien prouver.
	 *
	 * <p>Disposition du PNG : 8 octets de signature, la longueur de l'IHDR, son type aux
	 * offsets 12 a 15, largeur et hauteur aux offsets 16 et 20, puis le CRC a l'offset 29,
	 * calcule sur le type et les donnees.
	 */
	private byte[] pngDeclaringSize(int width, int height) {
		var png = onePixelPng();
		var buffer = ByteBuffer.wrap(png);
		buffer.putInt(16, width);
		buffer.putInt(20, height);
		var crc = new CRC32();
		crc.update(png, 12, 17);
		buffer.putInt(29, (int) crc.getValue());
		return png;
	}
}
