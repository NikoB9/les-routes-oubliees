package fr.lesroutesoubliees.routesoubliees.home;

import java.time.OffsetDateTime;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

record AdminHomeMessageUpsertRequest(
	@NotBlank @Size(max = 160) String title,
	@NotBlank String contentMarkdown,
	@NotNull HomeMessageImportance importance,
	@NotNull EditorialStatus status,
	boolean countdownEnabled,
	OffsetDateTime endsAt,
	@Size(max = 280) String expiredMessage
) {
}
