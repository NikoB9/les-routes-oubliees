package fr.lesroutesoubliees.routesoubliees.radar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class AdminRadarPointIntegrationTests {

	private static final String ADMIN_EMAIL = "admin@example.invalid";
	private static final String ADMIN_SUBJECT = "subject-radar-points-admin";

	@Autowired
	private WebApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
		jdbc.update("delete from radar_points");
		jdbc.update("delete from portal_identities where normalized_email = ?", ADMIN_EMAIL);
		jdbc.update("""
			insert into portal_identities(
				id, cloudflare_subject, normalized_email, access_mode, selected_at, created_at, updated_at
			)
			values (?, ?, ?, 'GUEST', now(), now(), now())
			""", UUID.randomUUID(), ADMIN_SUBJECT, ADMIN_EMAIL);
	}

	@Test
	void importsCartePointsAndExposesOnlyActiveOnTheRadar() throws Exception {
		mvc.perform(multipart("/api/admin/radar/points/import-carte")
				.file(carteFile(realisticCarte()))
				.with(authentication(admin()))
				.with(csrf()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].title").value("Point public"))
			.andExpect(jsonPath("$[0].latitude").value(closeTo(48.61834, 0.00001)))
			.andExpect(jsonPath("$[0].longitude").value(closeTo(3.13866, 0.00001)))
			.andExpect(jsonPath("$[0].sourceImageKey").value("img_demo"))
			.andExpect(jsonPath("$[1].active").value(false));

		mvc.perform(get("/api/radar/snapshot").with(authentication(admin())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.points.length()").value(1))
			.andExpect(jsonPath("$.points[0].title").value("Point public"))
			.andExpect(jsonPath("$.points[0].sourceImageKey").doesNotExist())
			.andExpect(jsonPath("$.participants.length()").value(0));
	}

	@Test
	void updateAndDeleteManageImportedPoints() throws Exception {
		mvc.perform(multipart("/api/admin/radar/points/import-carte")
				.file(carteFile(realisticCarte()))
				.with(authentication(admin()))
				.with(csrf()))
			.andExpect(status().isOk());
		var id = jdbc.queryForObject("select id from radar_points where title = 'Point public'", UUID.class);

		mvc.perform(put("/api/admin/radar/points/{id}", id)
				.with(authentication(admin()))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"active\": false, \"imageMediaId\": null}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));

		mvc.perform(get("/api/radar/snapshot").with(authentication(admin())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.points.length()").value(0));

		mvc.perform(delete("/api/admin/radar/points/{id}", id)
				.with(authentication(admin()))
				.with(csrf()))
			.andExpect(status().isNoContent());

		assertThat(jdbc.queryForObject("select count(*) from radar_points where id = ?", Long.class, id)).isZero();
	}

	@Test
	void refusesIncoherentCarteFiles() throws Exception {
		mvc.perform(multipart("/api/admin/radar/points/import-carte")
				.file(carteFile("""
					{
					  "layers": [
					    {
					      "dessin": true,
					      "type": "Vector",
					      "data": {
					        "decimals": 3,
					        "features": [["KRbwk,B~LpDe"]],
					        "popupContent": []
					      }
					    }
					  ]
					}
					"""))
				.with(authentication(admin()))
				.with(csrf()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("Le nombre de geometries ne correspond pas au nombre d'infobulles."));
	}

	@Test
	void refusesCartePointsWithoutDescription() throws Exception {
		mvc.perform(multipart("/api/admin/radar/points/import-carte")
				.file(carteFile("""
					{
					  "layers": [
					    {
					      "dessin": true,
					      "type": "Vector",
					      "data": {
					        "decimals": 3,
					        "features": [["KRbwk,B~LpDe"]],
					        "popupContent": [
					          {
					            "titre": "Point sans description",
					            "desc": ""
					          }
					        ]
					      }
					    }
					  ]
					}
					"""))
				.with(authentication(admin()))
				.with(csrf()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("Un point importe n'a pas de description."));
	}

	private MockMultipartFile carteFile(String content) {
		return new MockMultipartFile(
			"file",
			"sample.carte",
			"application/json",
			content.getBytes(StandardCharsets.UTF_8));
	}

	private String validCarte() {
		return """
			{
			  "layers": [
			    {
			      "dessin": true,
			      "type": "Vector",
			      "data": {
			        "decimals": 3,
			        "features": [
			          ["KRbwk,B~LpDe"],
			          ["KSr* ,B~L#$b"]
			        ],
			        "popupContent": [
			          {
			            "active": true,
			            "titre": "Point public",
			            "desc": "Description publique",
			            "img": "img_demo"
			          },
			          {
			            "active": false,
			            "titre": "Point masque",
			            "desc": "Description masquee",
			            "img": "img_hidden"
			          }
			        ]
			      }
			    }
			  ]
			}
			""";
	}

	private String realisticCarte() {
		return """
			{
			  "param": {
			    "lon": 3.1495140367965186,
			    "lat": 48.616768983070386,
			    "proj": { "valeur": "EPSG:4326" }
			  },
			  "layers": [
			    {
			      "id": 5,
			      "dessin": true,
			      "attributes": [],
			      "type": "Vector",
			      "title": "Dessin",
			      "visibility": true,
			      "mode": "vector",
			      "data": {
			        "type": "FeatureCollection",
			        "decimals": 3,
			        "hashProperties": [],
			        "features": [
			          ["KRbwk,B~LpDe"],
			          ["KSr* ,B~L#$b"]
			        ],
			        "style": [
			          { "zi": 0, "pgy": "pirate-pirate-carte", "prd": 20, "pic": "rgba(0, 0, 0, 1)", "pf": "sign" },
			          { "zi": 0, "pgy": "pirate-pirate-coffre", "prd": 20, "pic": "rgba(0, 0, 0, 1)", "pf": "sign" }
			        ],
			        "popupContent": [
			          {
			            "active": true,
			            "titre": "Point public",
			            "desc": "Description publique anonymisee.",
			            "img": "img_demo",
			            "coord": true
			          },
			          {
			            "active": false,
			            "titre": "Point masque",
			            "desc": "Description masquee anonymisee.",
			            "img": "img_hidden",
			            "coord": true
			          }
			        ]
			      }
			    }
			  ]
			}
			""";
	}

	private UsernamePasswordAuthenticationToken admin() {
		return new UsernamePasswordAuthenticationToken(
			new CloudflareAccessPrincipal(ADMIN_SUBJECT, ADMIN_EMAIL),
			null,
			List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN")));
	}
}
