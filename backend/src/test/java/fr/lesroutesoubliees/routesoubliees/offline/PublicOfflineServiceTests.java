package fr.lesroutesoubliees.routesoubliees.offline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import fr.lesroutesoubliees.routesoubliees.adventurer.PublicAdventurerService;
import fr.lesroutesoubliees.routesoubliees.group.PublicCompanyService;
import fr.lesroutesoubliees.routesoubliees.home.PublicHomeMessageResponse;
import fr.lesroutesoubliees.routesoubliees.home.PublicHomeMessageService;
import fr.lesroutesoubliees.routesoubliees.map.PublicMapResponse;
import fr.lesroutesoubliees.routesoubliees.map.PublicMapService;
import fr.lesroutesoubliees.routesoubliees.quest.PublicQuestDetailResponse;
import fr.lesroutesoubliees.routesoubliees.quest.PublicQuestService;
import fr.lesroutesoubliees.routesoubliees.quest.PublicQuestSummaryResponse;
import fr.lesroutesoubliees.routesoubliees.settings.PublicSiteSettingsResponse;
import fr.lesroutesoubliees.routesoubliees.settings.SiteSettingsService;
import fr.lesroutesoubliees.routesoubliees.settings.SiteStatus;

class PublicOfflineServiceTests {

	@Test
	void buildsPublicSnapshotFromVisiblePublicServices() {
		var service = serviceWithQuestTitle("Quete visible");

		var snapshot = service.snapshot();

		assertThat(snapshot.version()).matches("[a-f0-9]{64}");
		assertThat(snapshot.home().message().contentHtml()).contains("<strong>pret</strong>");
		assertThat(snapshot.quests()).extracting(PublicQuestSummaryResponse::code).containsExactly("QUEST_1");
		assertThat(snapshot.questDetails()).extracting(PublicQuestDetailResponse::code).containsExactly("QUEST_1");
	}

	@Test
	void changesVersionWhenPublicSnapshotChanges() {
		var firstVersion = serviceWithQuestTitle("Quete visible").contentVersion();
		var secondVersion = serviceWithQuestTitle("Quete modifiee").contentVersion();

		assertThat(secondVersion).isNotEqualTo(firstVersion);
	}

	private PublicOfflineService serviceWithQuestTitle(String questTitle) {
		var settings = mock(SiteSettingsService.class);
		var messages = mock(PublicHomeMessageService.class);
		var companies = mock(PublicCompanyService.class);
		var adventurers = mock(PublicAdventurerService.class);
		var maps = mock(PublicMapService.class);
		var quests = mock(PublicQuestService.class);

		var questId = UUID.fromString("50000000-0000-0000-0000-000000000001");
		var summary = new PublicQuestSummaryResponse(questId, "QUEST_1", questTitle, "Resume", 1);
		var detail = new PublicQuestDetailResponse(
			questId,
			"QUEST_1",
			questTitle,
			"Resume",
			"<p>Evenement</p>",
			"",
			"",
			"",
			1);

		when(settings.publicSettings()).thenReturn(new PublicSiteSettingsResponse(
			"Les Routes Oubliees",
			null,
			null,
			"Europe/Paris",
			SiteStatus.ONLINE,
			null,
			"Accessibilite"));
		when(messages.activeMessage()).thenReturn(new PublicHomeMessageResponse(
			UUID.fromString("10000000-0000-0000-0000-000000000001"),
			"Parchemin",
			"<p>Depart <strong>pret</strong></p>",
			"INFORMATION",
			false,
			null,
			"Europe/Paris",
			null));
		when(companies.activeCompany()).thenReturn(null);
		when(adventurers.visibleAdventurers()).thenReturn(List.of());
		when(maps.publicMap()).thenReturn(new PublicMapResponse(null, List.of()));
		when(quests.visibleQuests()).thenReturn(List.of(summary));
		when(quests.visibleQuest("QUEST_1")).thenReturn(detail);

		return new PublicOfflineService(settings, messages, companies, adventurers, maps, quests);
	}
}
