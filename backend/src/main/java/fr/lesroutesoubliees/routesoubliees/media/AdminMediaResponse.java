package fr.lesroutesoubliees.routesoubliees.media;

import java.time.OffsetDateTime;
import java.util.UUID;

record AdminMediaResponse(
	UUID id,
	String originalFilename,
	String url,
	String mimeType,
	long sizeBytes,
	int width,
	int height,
	String altText,
	OffsetDateTime createdAt,
	String createdBy
) {

	static AdminMediaResponse from(MediaAsset asset) {
		return new AdminMediaResponse(
			asset.id(),
			asset.originalFilename(),
			"/media/" + asset.id(),
			asset.mimeType(),
			asset.sizeBytes(),
			asset.width(),
			asset.height(),
			asset.altText(),
			asset.createdAt(),
			asset.createdBy());
	}
}
