package fr.lesroutesoubliees.routesoubliees.radar;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import fr.lesroutesoubliees.routesoubliees.portal.PortalAccessMode;

record RadarLocationRequest(
	@DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
	@DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
	@DecimalMin("0.1") @DecimalMax("10000.0") double accuracyM,
	@NotNull OffsetDateTime observedAt
) {
}

record TreasurePositionRequest(
	int schemaVersion,
	String beacon,
	@DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
	@DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
	@DecimalMin("0.1") @DecimalMax("10000.0") double accuracyM,
	@NotNull OffsetDateTime observedAt
) {
}

record RadarSnapshotResponse(
	OffsetDateTime serverTime,
	RadarIdentityResponse currentIdentity,
	RadarTreasureResponse treasure,
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

record AdminRadarSettingsResponse(
	boolean treasureVisible,
	RadarTreasureResponse treasure
) {
}

record AdminRadarSettingsUpdateRequest(boolean treasureVisible) {
}
