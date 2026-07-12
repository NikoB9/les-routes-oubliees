package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/notebook")
class PublicNotebookController {

	private final PublicQuestService quests;

	PublicNotebookController(PublicQuestService quests) {
		this.quests = quests;
	}

	@GetMapping
	List<PublicQuestSummaryResponse> listQuests() {
		return quests.visibleQuests();
	}

	@GetMapping("/{code}")
	PublicQuestDetailResponse getQuest(@PathVariable String code) {
		return quests.visibleQuest(code);
	}
}
