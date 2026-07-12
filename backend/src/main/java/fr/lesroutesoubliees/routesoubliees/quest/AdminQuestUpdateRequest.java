package fr.lesroutesoubliees.routesoubliees.quest;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AdminQuestUpdateRequest(
	@NotBlank
	@Size(max = 160)
	String title,

	@NotBlank
	@Size(max = 700)
	String summary,

	@NotNull
	String importantEventsMarkdown,

	@NotNull
	String discoveredCluesMarkdown,

	@NotNull
	String completedTrialsMarkdown,

	@NotNull
	String extraContentMarkdown,

	@NotNull
	String adminDraftMarkdown,

	@NotNull
	EditorialStatus status,

	boolean visibleToPlayers
) {
}
