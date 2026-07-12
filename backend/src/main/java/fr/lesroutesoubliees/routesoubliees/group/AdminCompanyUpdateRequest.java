package fr.lesroutesoubliees.routesoubliees.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record AdminCompanyUpdateRequest(
	@NotBlank @Size(max = 160) String name,
	@Size(max = 255) String emblemPath,
	@Size(max = 280) String imageAlt,
	@NotBlank @Size(max = 500) String shortDescription,
	@NotBlank String longDescriptionMarkdown
) {
}
