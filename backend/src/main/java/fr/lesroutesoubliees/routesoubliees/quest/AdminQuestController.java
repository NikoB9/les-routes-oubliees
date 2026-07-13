package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;

@Validated
@RestController
@RequestMapping("/api/admin/quest-tabs")
class AdminQuestController {

	private final AdminQuestService quests;
	private final AdminIdentity identity;

	AdminQuestController(AdminQuestService quests, AdminIdentity identity) {
		this.quests = quests;
		this.identity = identity;
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
	AdminQuestResponse updateQuest(
		@PathVariable String code,
		@Valid @RequestBody AdminQuestUpdateRequest request,
		Authentication authentication
	) {
		return quests.updateQuest(code, request, identity.email(authentication));
	}

	@PostMapping("/preview")
	AdminQuestPreviewResponse preview(@Valid @RequestBody AdminQuestUpdateRequest request) {
		return quests.preview(request);
	}

	@PostMapping("/{code}/publish")
	AdminQuestResponse publishQuest(
		@PathVariable String code,
		@RequestBody(required = false) AdminQuestPublishRequest request,
		Authentication authentication
	) {
		return quests.publishQuest(code, request == null || request.visibleToPlayers(), identity.email(authentication));
	}

	@PostMapping("/{code}/hide")
	AdminQuestResponse hideQuest(@PathVariable String code, Authentication authentication) {
		return quests.hideQuest(code, identity.email(authentication));
	}

	@PostMapping("/{code}/archive")
	AdminQuestResponse archiveQuest(@PathVariable String code, Authentication authentication) {
		return quests.archiveQuest(code, identity.email(authentication));
	}
}
