export type QuestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PublicQuestSummary {
  id: string;
  code: string;
  title: string;
  summary: string;
  displayOrder: number;
}

export interface PublicQuestDetail extends PublicQuestSummary {
  importantEventsHtml: string;
  discoveredCluesHtml: string;
  completedTrialsHtml: string;
  extraContentHtml: string;
}

export interface AdminQuest extends PublicQuestDetail {
  importantEventsMarkdown: string;
  discoveredCluesMarkdown: string;
  completedTrialsMarkdown: string;
  extraContentMarkdown: string;
  adminDraftMarkdown: string;
  adminDraftHtml: string;
  status: QuestStatus;
  visibleToPlayers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuestUpdate {
  title: string;
  summary: string;
  importantEventsMarkdown: string;
  discoveredCluesMarkdown: string;
  completedTrialsMarkdown: string;
  extraContentMarkdown: string;
  adminDraftMarkdown: string;
  status: QuestStatus;
  visibleToPlayers: boolean;
}

export interface AdminQuestPreview {
  importantEventsHtml: string;
  discoveredCluesHtml: string;
  completedTrialsHtml: string;
  extraContentHtml: string;
  adminDraftHtml: string;
}
