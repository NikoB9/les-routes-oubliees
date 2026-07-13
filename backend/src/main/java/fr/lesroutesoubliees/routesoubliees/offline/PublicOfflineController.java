package fr.lesroutesoubliees.routesoubliees.offline;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
class PublicOfflineController {

	private final PublicOfflineService offline;

	PublicOfflineController(PublicOfflineService offline) {
		this.offline = offline;
	}

	@GetMapping("/content-version")
	PublicContentVersionResponse contentVersion() {
		return new PublicContentVersionResponse(offline.contentVersion());
	}

	@GetMapping("/offline-snapshot")
	PublicOfflineSnapshotResponse offlineSnapshot() {
		return offline.snapshot();
	}
}
