package fr.lesroutesoubliees.routesoubliees.offline;

import java.util.List;

import fr.lesroutesoubliees.routesoubliees.home.PublicHomeResponse;
import fr.lesroutesoubliees.routesoubliees.map.PublicMapResponse;
import fr.lesroutesoubliees.routesoubliees.quest.PublicQuestDetailResponse;
import fr.lesroutesoubliees.routesoubliees.quest.PublicQuestSummaryResponse;
import fr.lesroutesoubliees.routesoubliees.settings.PublicSiteSettingsResponse;

public record PublicOfflineSnapshotResponse(
	String version,
	PublicSiteSettingsResponse settings,
	PublicHomeResponse home,
	PublicMapResponse map,
	List<PublicQuestSummaryResponse> quests,
	List<PublicQuestDetailResponse> questDetails
) {
}
