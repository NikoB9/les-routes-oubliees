package fr.lesroutesoubliees.routesoubliees.quest;

import java.time.OffsetDateTime;
import java.util.UUID;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

public record AdminQuestResponse(
	UUID id,
	String code,
	String title,
	String summary,
	String importantEventsMarkdown,
	String importantEventsHtml,
	String discoveredCluesMarkdown,
	String discoveredCluesHtml,
	String completedTrialsMarkdown,
	String completedTrialsHtml,
	String extraContentMarkdown,
	String extraContentHtml,
	String adminDraftMarkdown,
	String adminDraftHtml,
	EditorialStatus status,
	boolean visibleToPlayers,
	int displayOrder,
	OffsetDateTime createdAt,
	OffsetDateTime updatedAt
) {
}
