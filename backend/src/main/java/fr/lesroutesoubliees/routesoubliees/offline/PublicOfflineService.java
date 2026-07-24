package fr.lesroutesoubliees.routesoubliees.offline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

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

	PublicOfflineService(
		SiteSettingsService settings,
		PublicHomeMessageService messages,
		PublicCompanyService companies,
		PublicAdventurerService adventurers,
		PublicMapService maps,
		PublicQuestService quests
	) {
		this.settings = settings;
		this.messages = messages;
		this.companies = companies;
		this.adventurers = adventurers;
		this.maps = maps;
		this.quests = quests;
	}

	@Transactional(readOnly = true)
	public String contentVersion() {
		return version(snapshotPayload());
	}

	@Transactional(readOnly = true)
	public PublicOfflineSnapshotResponse snapshot() {
		var payload = snapshotPayload();
		return new PublicOfflineSnapshotResponse(
			version(payload),
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

	private String version(PublicOfflineSnapshotPayload payload) {
		try {
			var digest = MessageDigest.getInstance("SHA-256");
			var bytes = digest.digest(payload.toString().getBytes(StandardCharsets.UTF_8));
			return toHex(bytes);
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("Unable to compute public content version", exception);
		}
	}

	private String toHex(byte[] bytes) {
		var builder = new StringBuilder(bytes.length * 2);
		for (var value : bytes) {
			builder.append(String.format("%02x", value));
		}
		return builder.toString();
	}
}
