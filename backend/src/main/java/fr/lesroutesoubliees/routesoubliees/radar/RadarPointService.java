package fr.lesroutesoubliees.routesoubliees.radar;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
class RadarPointService {

	private static final int MAX_CARTE_BYTES = 512 * 1024;
	private static final int MAX_GEOJSONX_TOKEN_LENGTH = 16;
	private static final String GEOJSONX_RADIX =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ !#$%&'()*-.:<=>?@[]^_`{|}~";
	private static final double WEB_MERCATOR_RADIUS = 6378137.0;

	private final JdbcTemplate jdbc;
	private final ObjectMapper json;
	private final AuditService audit;
	private final Clock clock;

	RadarPointService(JdbcTemplate jdbc, ObjectMapper json, AuditService audit, Clock clock) {
		this.jdbc = jdbc;
		this.json = json;
		this.audit = audit;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	List<AdminRadarPointResponse> listAdminPoints() {
		return jdbc.query("""
			select rp.id, rp.title, rp.description, rp.latitude, rp.longitude, rp.active,
			       rp.display_order, rp.source_image_key, rp.image_media_id,
			       ma.alt_text as image_alt_text, rp.created_at, rp.updated_at
			from radar_points rp
			left join media_assets ma on ma.id = rp.image_media_id
			order by rp.display_order
			""", this::mapAdminPoint);
	}

	@Transactional(readOnly = true)
	List<RadarPointResponse> activePoints() {
		return jdbc.query("""
			select rp.id, rp.title, rp.description, rp.latitude, rp.longitude,
			       rp.source_image_key, rp.image_media_id, ma.alt_text as image_alt_text
			from radar_points rp
			left join media_assets ma on ma.id = rp.image_media_id
			where rp.active = true
			order by rp.display_order
			""", this::mapPublicPoint);
	}

	@Transactional
	List<AdminRadarPointResponse> importCarte(MultipartFile file, String actorEmail) {
		var imported = parseCarte(file);
		jdbc.update("delete from radar_points");
		var now = now();
		for (var point : imported) {
			jdbc.update("""
				insert into radar_points(
					id, title, description, latitude, longitude, active, display_order,
					source_image_key, image_media_id, created_at, updated_at
				)
				values (?, ?, ?, ?, ?, ?, ?, ?, null, ?, ?)
				""",
				UUID.randomUUID(),
				point.title(),
				point.description(),
				BigDecimal.valueOf(point.latitude()),
				BigDecimal.valueOf(point.longitude()),
				point.active(),
				point.displayOrder(),
				point.sourceImageKey(),
				now,
				now);
		}
		audit.record(actorEmail, "RADAR_POINTS_IMPORTED", "RADAR_POINT", null,
			imported.size() + " point(s) Radar importes depuis une carte IGN");
		return listAdminPoints();
	}

	@Transactional
	AdminRadarPointResponse updatePoint(UUID id, AdminRadarPointUpdateRequest request, String actorEmail) {
		assertMediaExists(request.imageMediaId());
		var updated = jdbc.update("""
			update radar_points
			set active = ?, image_media_id = ?, updated_at = ?
			where id = ?
			""", request.active(), request.imageMediaId(), now(), id);
		if (updated == 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Point Radar introuvable.");
		}
		audit.record(actorEmail, "RADAR_POINT_UPDATED", "RADAR_POINT", id.toString(), "Point Radar modifie");
		return findAdminPoint(id);
	}

	@Transactional
	void deletePoint(UUID id, String actorEmail) {
		var deleted = jdbc.update("delete from radar_points where id = ?", id);
		if (deleted == 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Point Radar introuvable.");
		}
		audit.record(actorEmail, "RADAR_POINT_DELETED", "RADAR_POINT", id.toString(), "Point Radar supprime");
	}

	private List<ImportedRadarPoint> parseCarte(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier .carte est obligatoire.");
		}
		if (file.getSize() > MAX_CARTE_BYTES) {
			throw new ResponseStatusException(HttpStatus.valueOf(413), "Le fichier .carte depasse la taille autorisee.");
		}
		var filename = file.getOriginalFilename();
		if (!StringUtils.hasText(filename) || !filename.toLowerCase(java.util.Locale.ROOT).endsWith(".carte")) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier doit porter l'extension .carte.");
		}
		var contentType = file.getContentType();
		if (StringUtils.hasText(contentType)
			&& !"application/json".equalsIgnoreCase(contentType)
			&& !"application/octet-stream".equalsIgnoreCase(contentType)) {
			throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Type de fichier .carte refuse.");
		}
		try {
			var root = json.readTree(file.getBytes());
			var data = drawingLayerData(root);
			var decimals = requiredInt(data, "decimals");
			if (decimals < 0 || decimals > 7) {
				throw badCarte("Precision GeoJSONX invalide.");
			}
			var features = requiredArray(data, "features");
			var popupContent = requiredArray(data, "popupContent");
			if (features.size() != popupContent.size()) {
				throw badCarte("Le nombre de geometries ne correspond pas au nombre d'infobulles.");
			}
			var points = new ArrayList<ImportedRadarPoint>();
			for (var index = 0; index < features.size(); index++) {
				var coordinates = pointCoordinates(features.get(index), decimals);
				var popup = popupContent.get(index);
				var title = text(popup, "titre");
				if (!StringUtils.hasText(title)) {
					throw badCarte("Un point importe n'a pas de titre.");
				}
				if (title.length() > 160) {
					throw badCarte("Un titre de point Radar depasse 160 caracteres.");
				}
				var description = text(popup, "desc");
				if (!StringUtils.hasText(description)) {
					throw badCarte("Un point importe n'a pas de description.");
				}
				if (description.length() > 2000) {
					throw badCarte("Une description de point Radar depasse 2000 caracteres.");
				}
				var sourceImageKey = blankToNull(text(popup, "img"));
				if (sourceImageKey != null && sourceImageKey.length() > 120) {
					throw badCarte("Une cle image IGN depasse 120 caracteres.");
				}
				points.add(new ImportedRadarPoint(
					title,
					description,
					coordinates.latitude(),
					coordinates.longitude(),
					booleanValue(popup, "active", true),
					index + 1,
					sourceImageKey));
			}
			if (points.isEmpty()) {
				throw badCarte("La carte ne contient aucun point a importer.");
			}
			return points;
		}
		catch (IOException exception) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier .carte n'est pas un JSON lisible.", exception);
		}
	}

	private JsonNode drawingLayerData(JsonNode root) {
		var layers = requiredArray(root, "layers");
		for (var layer : layers) {
			if (layer.path("dessin").asBoolean(false) && "Vector".equals(layer.path("type").asText())) {
				var data = layer.path("data");
				if (data.isObject()) {
					return data;
				}
			}
		}
		throw badCarte("Aucune couche de dessin vectoriel n'a ete trouvee.");
	}

	private RadarCoordinate pointCoordinates(JsonNode feature, int decimals) {
		if (!feature.isArray() || feature.isEmpty() || !feature.get(0).isTextual()) {
			throw badCarte("Seuls les points GeoJSONX sont pris en charge.");
		}
		var parts = feature.get(0).asText().split(",", -1);
		if (parts.length != 2) {
			throw badCarte("Coordonnees GeoJSONX invalides.");
		}
		var x = decodeNumber(parts[0], decimals);
		var y = decodeNumber(parts[1], decimals);
		var longitude = Math.toDegrees(x / WEB_MERCATOR_RADIUS);
		var latitude = Math.toDegrees(2.0 * Math.atan(Math.exp(y / WEB_MERCATOR_RADIUS)) - Math.PI / 2.0);
		if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
			throw badCarte("Coordonnees decodees hors limites.");
		}
		return new RadarCoordinate(latitude, longitude);
	}

	private double decodeNumber(String encoded, int decimals) {
		if (encoded.isEmpty()) {
			throw badCarte("Nombre GeoJSONX vide.");
		}
		var decoded = 0L;
		for (var index = 0; index < encoded.length(); index++) {
			if (encoded.length() > MAX_GEOJSONX_TOKEN_LENGTH) {
				throw badCarte("Nombre GeoJSONX trop long.");
			}
			var value = GEOJSONX_RADIX.indexOf(encoded.charAt(index));
			if (value < 0) {
				throw badCarte("Caractere GeoJSONX inconnu.");
			}
			try {
				decoded = Math.addExact(Math.multiplyExact(decoded, GEOJSONX_RADIX.length()), value);
			}
			catch (ArithmeticException exception) {
				throw badCarte("Nombre GeoJSONX trop grand.");
			}
		}
		var result = Math.floorDiv(decoded, 2);
		if (result * 2 != decoded) {
			result = -1 - result;
		}
		return result / Math.pow(10, decimals);
	}

	private AdminRadarPointResponse findAdminPoint(UUID id) {
		var rows = jdbc.query("""
			select rp.id, rp.title, rp.description, rp.latitude, rp.longitude, rp.active,
			       rp.display_order, rp.source_image_key, rp.image_media_id,
			       ma.alt_text as image_alt_text, rp.created_at, rp.updated_at
			from radar_points rp
			left join media_assets ma on ma.id = rp.image_media_id
			where rp.id = ?
			""", this::mapAdminPoint, id);
		if (rows.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Point Radar introuvable.");
		}
		return rows.getFirst();
	}

	private AdminRadarPointResponse mapAdminPoint(ResultSet rs, int rowNum) throws SQLException {
		var mediaId = rs.getObject("image_media_id", UUID.class);
		return new AdminRadarPointResponse(
			rs.getObject("id", UUID.class),
			rs.getString("title"),
			rs.getString("description"),
			rs.getDouble("latitude"),
			rs.getDouble("longitude"),
			rs.getBoolean("active"),
			rs.getInt("display_order"),
			rs.getString("source_image_key"),
			mediaId,
			mediaId == null ? null : "/media/" + mediaId,
			rs.getString("image_alt_text"),
			offset(rs.getTimestamp("created_at")),
			offset(rs.getTimestamp("updated_at")));
	}

	private RadarPointResponse mapPublicPoint(ResultSet rs, int rowNum) throws SQLException {
		var mediaId = rs.getObject("image_media_id", UUID.class);
		return new RadarPointResponse(
			rs.getObject("id", UUID.class),
			rs.getString("title"),
			rs.getString("description"),
			rs.getDouble("latitude"),
			rs.getDouble("longitude"),
			mediaId == null ? null : "/media/" + mediaId,
			rs.getString("image_alt_text"));
	}

	private void assertMediaExists(UUID mediaId) {
		if (mediaId == null) {
			return;
		}
		var found = jdbc.queryForObject("select count(*) from media_assets where id = ?", Long.class, mediaId);
		if (found == null || found == 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Media introuvable.");
		}
	}

	private JsonNode requiredArray(JsonNode node, String field) {
		var child = node.path(field);
		if (!child.isArray()) {
			throw badCarte("Champ .carte manquant ou invalide : " + field + ".");
		}
		return child;
	}

	private int requiredInt(JsonNode node, String field) {
		var child = node.path(field);
		if (!child.canConvertToInt()) {
			throw badCarte("Champ .carte manquant ou invalide : " + field + ".");
		}
		return child.asInt();
	}

	private String text(JsonNode node, String field) {
		var child = node.path(field);
		return child.isTextual() ? child.asText().trim() : "";
	}

	private boolean booleanValue(JsonNode node, String field, boolean fallback) {
		var child = node.path(field);
		return child.isBoolean() ? child.asBoolean() : fallback;
	}

	private String blankToNull(String value) {
		return StringUtils.hasText(value) ? value : null;
	}

	private ResponseStatusException badCarte(String detail) {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
	}

	private OffsetDateTime now() {
		return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
	}

	private OffsetDateTime offset(Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
	}

	private record ImportedRadarPoint(
		String title,
		String description,
		double latitude,
		double longitude,
		boolean active,
		int displayOrder,
		String sourceImageKey
	) {
	}

	private record RadarCoordinate(double latitude, double longitude) {
	}
}
