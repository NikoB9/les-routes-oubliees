package fr.lesroutesoubliees.routesoubliees.quest;

record AdminQuestPreviewResponse(
	String importantEventsHtml,
	String discoveredCluesHtml,
	String completedTrialsHtml,
	String extraContentHtml,
	String adminDraftHtml
) {
}
