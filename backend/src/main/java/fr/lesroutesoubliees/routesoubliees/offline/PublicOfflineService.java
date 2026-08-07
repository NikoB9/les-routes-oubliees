package fr.lesroutesoubliees.routesoubliees.offline;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.adventurer.PublicAdventurerService;
import fr.lesroutesoubliees.routesoubliees.group.PublicCompanyService;
import fr.lesroutesoubliees.routesoubliees.home.PublicHomeMessageService;
import fr.lesroutesoubliees.routesoubliees.home.PublicHomeResponse;
import fr.lesroutesoubliees.routesoubliees.map.PublicMapService;
import fr.lesroutesoubliees.routesoubliees.quest.PublicQuestService;
import fr.lesroutesoubliees.routesoubliees.settings.SiteSettingsService;

@Service
public class PublicOfflineService {

	private final SiteSettingsService settings;
	private final PublicHomeMessageService messages;
	private final PublicCompanyService companies;
	private final PublicAdventurerService adventurers;
	private final PublicMapService maps;
	private final PublicQuestService quests;
	private final PublicContentVersionCalculator versions;

	PublicOfflineService(
		SiteSettingsService settings,
		PublicHomeMessageService messages,
		PublicCompanyService companies,
		PublicAdventurerService adventurers,
		PublicMapService maps,
		PublicQuestService quests,
		PublicContentVersionCalculator versions
	) {
		this.settings = settings;
		this.messages = messages;
		this.companies = companies;
		this.adventurers = adventurers;
		this.maps = maps;
		this.quests = quests;
		this.versions = versions;
	}

	@Transactional(readOnly = true)
	public String contentVersion() {
		return versions.currentVersion();
	}

	/**
	 * Instantane public complet et sa version.
	 *
	 * <p>La version vient obligatoirement de la meme source que
	 * {@link #contentVersion()} : une version calculee autrement ici ne correspondrait jamais
	 * a celle que le client interroge ensuite, et il retelechargerait sans fin.
	 *
	 * <p>Elle est calculee <strong>avant</strong> la charge utile. Les deux lectures
	 * partagent la transaction mais pas l'instantane MVCC — PostgreSQL est en
	 * {@code READ COMMITTED} — donc une ecriture peut se glisser entre elles. Dans cet ordre,
	 * le pire cas est un contenu plus frais que sa version, corrige au rafraichissement
	 * suivant ; l'ordre inverse epinglerait un contenu perime.
	 */
	@Transactional(readOnly = true)
	public PublicOfflineSnapshotResponse snapshot() {
		var version = versions.currentVersion();
		var payload = snapshotPayload();
		return new PublicOfflineSnapshotResponse(
			version,
			payload.settings(),
			payload.home(),
			payload.map(),
			payload.quests(),
			payload.questDetails());
	}

	private PublicOfflineSnapshotPayload snapshotPayload() {
		var visibleQuests = quests.visibleQuests();
		var details = visibleQuests.stream()
			.map(quest -> quests.visibleQuest(quest.code()))
			.toList();

		return new PublicOfflineSnapshotPayload(
			settings.publicSettings(),
			new PublicHomeResponse(
				messages.activeMessage(),
				companies.activeCompany(),
				adventurers.visibleAdventurers()),
			maps.publicMap(),
			visibleQuests,
			details);
	}
}
