package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.UUID;

public record PublicQuestDetailResponse(
	UUID id,
	String code,
	String title,
	String summary,
	String importantEventsHtml,
	String discoveredCluesHtml,
	String completedTrialsHtml,
	String extraContentHtml,
	int displayOrder
) {
}
