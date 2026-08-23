package fr.lesroutesoubliees.routesoubliees.radar;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import fr.lesroutesoubliees.routesoubliees.portal.PortalAccessMode;

@JsonIgnoreProperties(ignoreUnknown = false)
record RadarLocationRequest(
	@NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
	@NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
	@NotNull @DecimalMin("0.1") @DecimalMax("10000.0") Double accuracyM,
	@NotNull OffsetDateTime observedAt
) {
}

@JsonIgnoreProperties(ignoreUnknown = false)
record TreasurePositionRequest(
	@NotNull @Min(1) Integer schemaVersion,
	@NotBlank String beacon,
	@NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
	@NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
	@NotNull @DecimalMin("0.1") @DecimalMax("10000.0") Double accuracyM,
	@NotNull OffsetDateTime observedAt
) {
}

/** Resultat d'un releve tresor : mise a jour appliquee ou mesure ignoree. */
enum TreasureUpdateOutcome {
	APPLIED,
	IGNORED
}

/**
 * Statut minimal renvoye lorsqu'un releve n'est pas strictement plus recent.
 *
 * <p>Ne contient jamais la position enregistree.
 */
record TreasureUpdateStatusResponse(String status) {

	static TreasureUpdateStatusResponse ignored() {
		return new TreasureUpdateStatusResponse("ignored");
	}
}

record RadarSnapshotResponse(
	OffsetDateTime serverTime,
	RadarIdentityResponse currentIdentity,
	RadarTreasureResponse treasure,
	List<RadarPointResponse> points,
	List<RadarParticipantResponse> participants
) {
}

record RadarIdentityResponse(
	UUID identityId,
	PortalAccessMode accessMode,
	UUID adventurerId,
	String displayName,
	String avatarPath
) {
}

record RadarTreasureResponse(
	double latitude,
	double longitude,
	double accuracyM,
	OffsetDateTime observedAt,
	OffsetDateTime receivedAt,
	boolean stale
) {
}

record RadarParticipantResponse(
	UUID identityId,
	PortalAccessMode accessMode,
	UUID adventurerId,
	String displayName,
	String avatarPath,
	double latitude,
	double longitude,
	double accuracyM,
	OffsetDateTime observedAt,
	OffsetDateTime receivedAt,
	boolean stale
) {
}

record RadarPointResponse(
	UUID id,
	String title,
	String description,
	double latitude,
	double longitude,
	String imageUrl,
	String imageAltText
) {
}

record AdminRadarSettingsResponse(
	boolean treasureVisible,
	RadarTreasureResponse treasure
) {
}

@JsonIgnoreProperties(ignoreUnknown = false)
record AdminRadarSettingsUpdateRequest(boolean treasureVisible) {
}

record AdminRadarPointResponse(
	UUID id,
	String title,
	String description,
	double latitude,
	double longitude,
	boolean active,
	int displayOrder,
	String sourceImageKey,
	UUID imageMediaId,
	String imageUrl,
	String imageAltText,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}

@JsonIgnoreProperties(ignoreUnknown = false)
record AdminRadarPointUpdateRequest(
	@NotNull Boolean active,
	UUID imageMediaId
) {
}
