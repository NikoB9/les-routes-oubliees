package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.UUID;

public record PublicQuestDetailResponse(
	UUID id,
	String code,
	String title,
	String summary,
	String importantEventsMarkdown,
	String discoveredCluesMarkdown,
	String completedTrialsMarkdown,
	String extraContentMarkdown,
	int displayOrder
) {
}
