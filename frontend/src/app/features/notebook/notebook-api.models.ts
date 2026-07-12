export type QuestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PublicQuestSummary {
  id: string;
  code: string;
  title: string;
  summary: string;
  displayOrder: number;
}

export interface PublicQuestDetail extends PublicQuestSummary {
  importantEventsMarkdown: string;
  importantEventsHtml: string;
  discoveredCluesMarkdown: string;
  discoveredCluesHtml: string;
  completedTrialsMarkdown: string;
  completedTrialsHtml: string;
  extraContentMarkdown: string;
  extraContentHtml: string;
}

export interface AdminQuest extends PublicQuestDetail {
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
