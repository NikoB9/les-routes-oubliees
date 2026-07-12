package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/admin/quest-tabs")
class AdminQuestController {

	private final AdminQuestService quests;

	AdminQuestController(AdminQuestService quests) {
		this.quests = quests;
	}

	@GetMapping
	List<AdminQuestResponse> listQuests() {
		return quests.listQuests();
	}

	@GetMapping("/{code}")
	AdminQuestResponse getQuest(@PathVariable String code) {
		return quests.getQuest(code);
	}

	@PutMapping("/{code}")
	AdminQuestResponse updateQuest(@PathVariable String code, @Valid @RequestBody AdminQuestUpdateRequest request) {
		return quests.updateQuest(code, request);
	}

	@PostMapping("/{code}/publish")
	AdminQuestResponse publishQuest(@PathVariable String code, @RequestBody(required = false) AdminQuestPublishRequest request) {
		return quests.publishQuest(code, request == null || request.visibleToPlayers());
	}

	@PostMapping("/{code}/hide")
	AdminQuestResponse hideQuest(@PathVariable String code) {
		return quests.hideQuest(code);
	}

	@PostMapping("/{code}/archive")
	AdminQuestResponse archiveQuest(@PathVariable String code) {
		return quests.archiveQuest(code);
	}
}
