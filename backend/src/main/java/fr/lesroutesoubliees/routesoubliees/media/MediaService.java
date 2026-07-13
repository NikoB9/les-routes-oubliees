package fr.lesroutesoubliees.routesoubliees.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;
import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

@Service
class MediaService {

	private static final List<String> ALLOWED_TYPES = List.of("image/png", "image/jpeg", "image/webp");

	private final MediaAssetRepository mediaAssets;
	private final JdbcTemplate jdbc;
	private final AuditService audit;
	private final Path storageRoot;
	private final long maxUploadBytes;

	MediaService(MediaAssetRepository mediaAssets, JdbcTemplate jdbc, AuditService audit, SiteProperties properties) {
		this.mediaAssets = mediaAssets;
		this.jdbc = jdbc;
		this.audit = audit;
		this.storageRoot = Path.of(properties.mediaStoragePath()).toAbsolutePath().normalize();
		this.maxUploadBytes = properties.mediaMaxUploadBytes();
	}

	@Transactional(readOnly = true)
	List<AdminMediaResponse> listMedia() {
		return mediaAssets.findAllByOrderByCreatedAtDesc().stream()
			.map(AdminMediaResponse::from)
			.toList();
	}

	@Transactional
	AdminMediaResponse upload(MultipartFile file, String altText, String createdBy) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est obligatoire.");
		}
		if (file.getSize() > maxUploadBytes) {
			throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Le fichier depasse la taille autorisee.");
		}
		var normalizedAlt = normalizeAltText(altText);
		var mimeType = normalizeMimeType(file.getContentType());
		var bytes = readBytes(file);
		var dimensions = validateImage(bytes, mimeType);
		var id = UUID.randomUUID();
		var extension = extensionFor(mimeType);
		var storedFilename = id + extension;
		var relativePath = "misc/" + storedFilename;
		var target = resolveStoragePath(relativePath);
		var originalFilename = normalizeOriginalFilename(file.getOriginalFilename());

		try {
			Files.createDirectories(target.getParent());
			Files.write(target, bytes);
			var asset = mediaAssets.save(new MediaAsset(
				id,
				originalFilename,
				storedFilename,
				relativePath,
				mimeType,
				bytes.length,
				dimensions.width(),
				dimensions.height(),
				normalizedAlt,
				createdBy));
			audit.record(createdBy, "MEDIA_UPLOADED", "MEDIA", asset.id().toString(), "Media ajoute");
			return AdminMediaResponse.from(asset);
		}
		catch (IOException ex) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Le média ne peut pas être stocké.", ex);
		}
		catch (RuntimeException ex) {
			deleteQuietly(target);
			throw ex;
		}
	}

	@Transactional(readOnly = true)
	StoredMedia publicMedia(UUID id) {
		var asset = mediaAssets.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Media introuvable."));
		var path = resolveStoragePath(asset.relativePath());
		if (!Files.isRegularFile(path)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Media introuvable.");
		}
		return new StoredMedia(asset, new FileSystemResource(path));
	}

	@Transactional
	void delete(UUID id, String actorEmail) {
		var asset = mediaAssets.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Media introuvable."));
		if (isReferenced(asset)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Le media est encore reference par un contenu.");
		}
		mediaAssets.delete(asset);
		deleteQuietly(resolveStoragePath(asset.relativePath()));
		audit.record(actorEmail, "MEDIA_DELETED", "MEDIA", id.toString(), "Média supprimé");
	}

	private boolean isReferenced(MediaAsset asset) {
		var url = "/media/" + asset.id();
		var textPattern = "%" + url + "%";
		var exactReferences = jdbc.queryForObject("""
			select
			    (select count(*) from company_profiles where emblem_path = ?) +
			    (select count(*) from adventurers where avatar_path = ?)
			""", Integer.class, url, url);
		var markdownReferences = jdbc.queryForObject("""
			select count(*) from quests
			where important_events_markdown like ?
			   or discovered_clues_markdown like ?
			   or completed_trials_markdown like ?
			   or extra_content_markdown like ?
			   or admin_draft_markdown like ?
			""", Integer.class, textPattern, textPattern, textPattern, textPattern, textPattern);
		return exactReferences != null && exactReferences > 0 || markdownReferences != null && markdownReferences > 0;
	}

	private String normalizeAltText(String value) {
		if (!StringUtils.hasText(value)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le texte alternatif est obligatoire.");
		}
		var normalized = value.trim();
		if (normalized.length() > 280) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le texte alternatif est trop long.");
		}
		return normalized;
	}

	private String normalizeMimeType(String contentType) {
		if (!StringUtils.hasText(contentType)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le type MIME est obligatoire.");
		}
		var normalized = contentType.toLowerCase(Locale.ROOT);
		if (!ALLOWED_TYPES.contains(normalized)) {
			throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Type de media refuse.");
		}
		return normalized;
	}

	private byte[] readBytes(MultipartFile file) {
		try {
			return file.getBytes();
		}
		catch (IOException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier ne peut pas être lu.", ex);
		}
	}

	private ImageDimensions validateImage(byte[] bytes, String mimeType) {
		if (bytes.length == 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide.");
		}
		return switch (mimeType) {
			case "image/png" -> validatePng(bytes);
			case "image/jpeg" -> validateJpeg(bytes);
			case "image/webp" -> validateWebp(bytes);
			default -> throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Type de media refuse.");
		};
	}

	private ImageDimensions validatePng(byte[] bytes) {
		if (bytes.length < 24
			|| bytes[0] != (byte) 0x89
			|| bytes[1] != 0x50
			|| bytes[2] != 0x4E
			|| bytes[3] != 0x47
			|| bytes[4] != 0x0D
			|| bytes[5] != 0x0A
			|| bytes[6] != 0x1A
			|| bytes[7] != 0x0A) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature PNG invalide.");
		}
		return imageIoDimensions(bytes);
	}

	private ImageDimensions validateJpeg(byte[] bytes) {
		if (bytes.length < 4 || bytes[0] != (byte) 0xFF || bytes[1] != (byte) 0xD8) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature JPEG invalide.");
		}
		return imageIoDimensions(bytes);
	}

	private ImageDimensions validateWebp(byte[] bytes) {
		if (bytes.length < 30
			|| bytes[0] != 0x52
			|| bytes[1] != 0x49
			|| bytes[2] != 0x46
			|| bytes[3] != 0x46
			|| bytes[8] != 0x57
			|| bytes[9] != 0x45
			|| bytes[10] != 0x42
			|| bytes[11] != 0x50) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature WebP invalide.");
		}
		if (bytes[12] == 0x56 && bytes[13] == 0x50 && bytes[14] == 0x38 && bytes[15] == 0x20) {
			return new ImageDimensions(littleEndian16(bytes, 26) & 0x3FFF, littleEndian16(bytes, 28) & 0x3FFF);
		}
		if (bytes[12] == 0x56 && bytes[13] == 0x50 && bytes[14] == 0x38 && bytes[15] == 0x4C) {
			var b0 = unsigned(bytes[21]);
			var b1 = unsigned(bytes[22]);
			var b2 = unsigned(bytes[23]);
			var b3 = unsigned(bytes[24]);
			var width = 1 + (((b1 & 0x3F) << 8) | b0);
			var height = 1 + ((b3 << 6) | (b2 >> 2) | ((b1 & 0xC0) << 6));
			return new ImageDimensions(width, height);
		}
		if (bytes[12] == 0x56 && bytes[13] == 0x50 && bytes[14] == 0x38 && bytes[15] == 0x58) {
			var width = 1 + littleEndian24(bytes, 24);
			var height = 1 + littleEndian24(bytes, 27);
			return new ImageDimensions(width, height);
		}
		throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format WebP invalide.");
	}

	private ImageDimensions imageIoDimensions(byte[] bytes) {
		try {
			BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
			if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image invalide.");
			}
			return new ImageDimensions(image.getWidth(), image.getHeight());
		}
		catch (IOException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image invalide.", ex);
		}
	}

	private Path resolveStoragePath(String relativePath) {
		var path = storageRoot.resolve(relativePath).normalize();
		if (!path.startsWith(storageRoot)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chemin de media invalide.");
		}
		return path;
	}

	private String normalizeOriginalFilename(String originalFilename) {
		if (!StringUtils.hasText(originalFilename)) {
			return "image";
		}
		var sanitized = originalFilename.replace('\\', '/');
		sanitized = sanitized.substring(sanitized.lastIndexOf('/') + 1).trim();
		return sanitized.isBlank() ? "image" : sanitized.substring(0, Math.min(sanitized.length(), 255));
	}

	private String extensionFor(String mimeType) {
		return switch (mimeType) {
			case "image/png" -> ".png";
			case "image/jpeg" -> ".jpg";
			case "image/webp" -> ".webp";
			default -> throw new IllegalArgumentException("Unsupported MIME type");
		};
	}

	private int littleEndian16(byte[] bytes, int offset) {
		return unsigned(bytes[offset]) | (unsigned(bytes[offset + 1]) << 8);
	}

	private int littleEndian24(byte[] bytes, int offset) {
		return unsigned(bytes[offset]) | (unsigned(bytes[offset + 1]) << 8) | (unsigned(bytes[offset + 2]) << 16);
	}

	private int unsigned(byte value) {
		return value & 0xFF;
	}

	private void deleteQuietly(Path path) {
		try {
			Files.deleteIfExists(path);
		}
		catch (IOException ignored) {
		}
	}

	private record ImageDimensions(int width, int height) {}
}
