package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminQuestService {

	private final QuestRepository repository;
	private final MarkdownRenderer markdownRenderer;

	AdminQuestService(QuestRepository repository, MarkdownRenderer markdownRenderer) {
		this.repository = repository;
		this.markdownRenderer = markdownRenderer;
	}

	@Transactional(readOnly = true)
	public List<AdminQuestResponse> listQuests() {
		return repository.findAllByOrderByDisplayOrderAsc()
			.stream()
			.map(this::toResponse)
			.toList();
	}

	@Transactional(readOnly = true)
	public AdminQuestResponse getQuest(String code) {
		return toResponse(findQuest(code));
	}

	@Transactional
	public AdminQuestResponse updateQuest(String code, AdminQuestUpdateRequest request) {
		var quest = findQuest(code);
		quest.update(
			request.title().trim(),
			request.summary().trim(),
			request.importantEventsMarkdown().trim(),
			request.discoveredCluesMarkdown().trim(),
			request.completedTrialsMarkdown().trim(),
			request.extraContentMarkdown().trim(),
			request.adminDraftMarkdown().trim(),
			request.status(),
			request.visibleToPlayers());
		return toResponse(quest);
	}

	@Transactional
	public AdminQuestResponse publishQuest(String code, boolean visibleToPlayers) {
		var quest = findQuest(code);
		quest.publish(visibleToPlayers);
		return toResponse(quest);
	}

	@Transactional
	public AdminQuestResponse hideQuest(String code) {
		var quest = findQuest(code);
		quest.hide();
		return toResponse(quest);
	}

	@Transactional
	public AdminQuestResponse archiveQuest(String code) {
		var quest = findQuest(code);
		quest.archive();
		return toResponse(quest);
	}

	private Quest findQuest(String code) {
		return repository.findByCode(code)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quest does not exist"));
	}

	private AdminQuestResponse toResponse(Quest quest) {
		return new AdminQuestResponse(
			quest.id(),
			quest.code(),
			quest.title(),
			quest.summary(),
			quest.importantEventsMarkdown(),
			markdownRenderer.render(quest.importantEventsMarkdown()),
			quest.discoveredCluesMarkdown(),
			markdownRenderer.render(quest.discoveredCluesMarkdown()),
			quest.completedTrialsMarkdown(),
			markdownRenderer.render(quest.completedTrialsMarkdown()),
			quest.extraContentMarkdown(),
			markdownRenderer.render(quest.extraContentMarkdown()),
			quest.adminDraftMarkdown(),
			markdownRenderer.render(quest.adminDraftMarkdown()),
			quest.status(),
			quest.visibleToPlayers(),
			quest.displayOrder(),
			quest.createdAt(),
			quest.updatedAt());
	}
}
