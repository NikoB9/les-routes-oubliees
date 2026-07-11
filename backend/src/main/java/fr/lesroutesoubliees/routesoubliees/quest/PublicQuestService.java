package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

@Service
public class PublicQuestService {

	private final QuestRepository repository;

	PublicQuestService(QuestRepository repository) {
		this.repository = repository;
	}

	@Transactional(readOnly = true)
	public List<PublicQuestSummaryResponse> visibleQuests() {
		return repository.findByStatusAndVisibleToPlayersTrueOrderByDisplayOrderAsc(EditorialStatus.PUBLISHED)
			.stream()
			.map(this::toSummary)
			.toList();
	}

	@Transactional(readOnly = true)
	public PublicQuestDetailResponse visibleQuest(String code) {
		return repository.findByCodeAndStatusAndVisibleToPlayersTrue(code, EditorialStatus.PUBLISHED)
			.map(this::toDetail)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quest is not visible"));
	}

	private PublicQuestSummaryResponse toSummary(Quest quest) {
		return new PublicQuestSummaryResponse(
			quest.id(),
			quest.code(),
			quest.title(),
			quest.summary(),
			quest.displayOrder());
	}

	private PublicQuestDetailResponse toDetail(Quest quest) {
		return new PublicQuestDetailResponse(
			quest.id(),
			quest.code(),
			quest.title(),
			quest.summary(),
			quest.importantEventsMarkdown(),
			quest.discoveredCluesMarkdown(),
			quest.completedTrialsMarkdown(),
			quest.extraContentMarkdown(),
			quest.displayOrder());
	}
}
