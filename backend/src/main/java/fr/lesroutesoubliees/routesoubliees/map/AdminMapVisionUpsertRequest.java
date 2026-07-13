package fr.lesroutesoubliees.routesoubliees.map;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

record AdminMapVisionUpsertRequest(
	@NotBlank
	@Size(max = 160)
	String name,

	@NotBlank
	String descriptionMarkdown,

	@NotBlank
	@Size(max = 255)
	String assetPath,

	@NotBlank
	@Size(max = 280)
	String imageAlt,

	@Min(1)
	@Max(999)
	int displayOrder,

	@NotNull
	EditorialStatus status
) {
}
