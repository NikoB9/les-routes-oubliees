package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
public class AdminQuestService {

	private final QuestRepository repository;
	private final MarkdownRenderer markdownRenderer;
	private final AuditService audit;

	AdminQuestService(QuestRepository repository, MarkdownRenderer markdownRenderer, AuditService audit) {
		this.repository = repository;
		this.markdownRenderer = markdownRenderer;
		this.audit = audit;
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
	public AdminQuestResponse updateQuest(String code, AdminQuestUpdateRequest request, String actorEmail) {
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
		audit.record(actorEmail, "QUEST_UPDATED", "QUEST", quest.code(), "Quete mise a jour");
		return toResponse(quest);
	}

	@Transactional(readOnly = true)
	public AdminQuestPreviewResponse preview(AdminQuestUpdateRequest request) {
		return new AdminQuestPreviewResponse(
			markdownRenderer.render(request.importantEventsMarkdown()),
			markdownRenderer.render(request.discoveredCluesMarkdown()),
			markdownRenderer.render(request.completedTrialsMarkdown()),
			markdownRenderer.render(request.extraContentMarkdown()),
			markdownRenderer.render(request.adminDraftMarkdown()));
	}

	@Transactional
	public AdminQuestResponse publishQuest(String code, boolean visibleToPlayers, String actorEmail) {
		var quest = findQuest(code);
		quest.publish(visibleToPlayers);
		audit.record(actorEmail, "QUEST_PUBLISHED", "QUEST", quest.code(), "Quete publiee");
		return toResponse(quest);
	}

	@Transactional
	public AdminQuestResponse hideQuest(String code, String actorEmail) {
		var quest = findQuest(code);
		quest.hide();
		audit.record(actorEmail, "QUEST_HIDDEN", "QUEST", quest.code(), "Quete masquee");
		return toResponse(quest);
	}

	@Transactional
	public AdminQuestResponse archiveQuest(String code, String actorEmail) {
		var quest = findQuest(code);
		quest.archive();
		audit.record(actorEmail, "QUEST_ARCHIVED", "QUEST", quest.code(), "Quete archivee");
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
