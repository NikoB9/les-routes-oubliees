package fr.lesroutesoubliees.routesoubliees.adventurer;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record AdminAdventurerUpsertRequest(
	@NotBlank @Size(max = 160) String name,
	@NotBlank @Size(max = 160) String title,
	@Size(max = 255) String avatarPath,
	@Size(max = 280) String avatarAlt,
	@NotBlank @Size(max = 500) String shortDescription,
	@NotBlank String strengths,
	@NotBlank String weaknesses,
	boolean visible,
	@Min(1) int displayOrder
) {
}
