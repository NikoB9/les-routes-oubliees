package fr.lesroutesoubliees.routesoubliees.map;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;
import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

@Service
class AdminMapService {

	private static final Pattern VERSIONED_MAP_ASSET =
		Pattern.compile("^/assets/maps/[A-Za-z0-9][A-Za-z0-9._-]*\\.(png|jpg|jpeg|webp)$");
	private static final Pattern MEDIA_ASSET =
		Pattern.compile("^/media/[0-9a-fA-F-]{36}$");

	private final MapVisionRepository visions;
	private final MapMarkerRepository markers;
	private final AuditService audit;

	AdminMapService(MapVisionRepository visions, MapMarkerRepository markers, AuditService audit) {
		this.visions = visions;
		this.markers = markers;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	List<AdminMapVisionResponse> listVisions() {
		return visions.findAllByOrderByDisplayOrderAsc().stream().map(this::toVisionResponse).toList();
	}

	@Transactional(readOnly = true)
	AdminMapVisionResponse getVision(UUID id) {
		return toVisionResponse(findVision(id));
	}

	@Transactional
	AdminMapVisionResponse createVision(AdminMapVisionUpsertRequest request, String actorEmail) {
		validateAssetPath(request.assetPath());
		var vision = new MapVision(
			UUID.randomUUID(),
			request.name().trim(),
			request.descriptionMarkdown().trim(),
			request.assetPath().trim(),
			request.imageAlt().trim(),
			request.displayOrder(),
			request.status(),
			false);
		visions.save(vision);
		audit.record(actorEmail, "MAP_VISION_CREATED", "MAP_VISION", vision.id().toString(), "Vision de carte créée");
		return toVisionResponse(vision);
	}

	@Transactional
	AdminMapVisionResponse updateVision(UUID id, AdminMapVisionUpsertRequest request, String actorEmail) {
		validateAssetPath(request.assetPath());
		var vision = findVision(id);
		vision.update(
			request.name().trim(),
			request.descriptionMarkdown().trim(),
			request.assetPath().trim(),
			request.imageAlt().trim(),
			request.displayOrder(),
			request.status());
		audit.record(actorEmail, "MAP_VISION_UPDATED", "MAP_VISION", vision.id().toString(), "Vision de carte modifiée");
		return toVisionResponse(vision);
	}

	@Transactional
	AdminMapVisionResponse activateVision(UUID id, String actorEmail) {
		var vision = findVision(id);
		if (vision.status() != EditorialStatus.PUBLISHED) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only a published map vision can be active");
		}
		visions.findByActiveTrue().forEach(MapVision::deactivate);
		visions.flush();
		vision.activate();
		audit.record(actorEmail, "MAP_VISION_ACTIVATED", "MAP_VISION", vision.id().toString(), "Vision de carte activee");
		return toVisionResponse(vision);
	}

	@Transactional
	void deleteVision(UUID id, String actorEmail) {
		var vision = findVision(id);
		if (vision.active()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Active map vision cannot be deleted");
		}
		visions.delete(vision);
		audit.record(actorEmail, "MAP_VISION_DELETED", "MAP_VISION", id.toString(), "Vision de carte supprimée");
	}

	@Transactional(readOnly = true)
	List<AdminMapMarkerResponse> listMarkers() {
		return markers.findAllByOrderByDisplayOrderAsc().stream().map(this::toMarkerResponse).toList();
	}

	@Transactional
	AdminMapMarkerResponse createMarker(AdminMapMarkerUpsertRequest request, String actorEmail) {
		var questId = findQuestId(request.questCode());
		var marker = new MapMarker(
			UUID.randomUUID(),
			questId,
			request.title().trim(),
			request.positionX(),
			request.positionY(),
			request.active(),
			request.displayOrder());
		markers.save(marker);
		audit.record(actorEmail, "MAP_MARKER_CREATED", "MAP_MARKER", marker.id().toString(), "Repère de carte créé");
		return toMarkerResponse(marker);
	}

	@Transactional
	AdminMapMarkerResponse updateMarker(UUID id, AdminMapMarkerUpsertRequest request, String actorEmail) {
		var marker = findMarker(id);
		marker.update(
			findQuestId(request.questCode()),
			request.title().trim(),
			request.positionX(),
			request.positionY(),
			request.active(),
			request.displayOrder());
		audit.record(actorEmail, "MAP_MARKER_UPDATED", "MAP_MARKER", marker.id().toString(), "Repère de carte modifié");
		return toMarkerResponse(marker);
	}

	@Transactional
	void deleteMarker(UUID id, String actorEmail) {
		var marker = findMarker(id);
		markers.delete(marker);
		audit.record(actorEmail, "MAP_MARKER_DELETED", "MAP_MARKER", id.toString(), "Repère de carte supprimé");
	}

	@Transactional(readOnly = true)
	AdminMapPreviewResponse preview(UUID visionId) {
		return new AdminMapPreviewResponse(
			toVisionResponse(findVision(visionId)),
			markers.findByActiveTrueOrderByDisplayOrderAsc().stream().map(this::toMarkerResponse).toList());
	}

	private MapVision findVision(UUID id) {
		return visions.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Map vision does not exist"));
	}

	private MapMarker findMarker(UUID id) {
		return markers.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Map marker does not exist"));
	}

	private UUID findQuestId(String questCode) {
		return markers.findQuestIdByCode(questCode)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quest code does not exist"));
	}

	private void validateAssetPath(String assetPath) {
		var value = assetPath == null ? "" : assetPath.trim();
		if (!VERSIONED_MAP_ASSET.matcher(value).matches() && !MEDIA_ASSET.matcher(value).matches()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Map asset must be a versioned map asset or media URL");
		}
	}

	private AdminMapVisionResponse toVisionResponse(MapVision vision) {
		return new AdminMapVisionResponse(
			vision.id(),
			vision.name(),
			vision.descriptionMarkdown(),
			vision.assetPath(),
			vision.imageAlt(),
			vision.displayOrder(),
			vision.status(),
			vision.active(),
			vision.createdAt(),
			vision.updatedAt());
	}

	private AdminMapMarkerResponse toMarkerResponse(MapMarker marker) {
		return new AdminMapMarkerResponse(
			marker.id(),
			markers.findQuestCodeById(marker.questId()).orElse("UNKNOWN"),
			marker.title(),
			marker.positionX(),
			marker.positionY(),
			marker.active(),
			marker.displayOrder(),
			marker.createdAt(),
			marker.updatedAt());
	}
}
