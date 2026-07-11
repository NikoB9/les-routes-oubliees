package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.UUID;

public record PublicQuestSummaryResponse(
	UUID id,
	String code,
	String title,
	String summary,
	int displayOrder
) {
}
