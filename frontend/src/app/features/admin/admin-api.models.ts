export interface AdminAuditLog {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface AdminDashboard {
  activeHomeMessageTitle: string | null;
  activeMapVisionName: string | null;
  activeCompanyName: string | null;
  visibleAdventurerCount: number;
  visibleQuestCount: number;
  mediaCount: number;
  activeAdministratorCount: number;
  latestAuditLogs: AdminAuditLog[];
}

export interface AdminAllowedEmail {
  id: string;
  email: string;
  label: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAllowedEmailCreate {
  email: string;
  label: string | null;
}

export interface AdminAllowedEmailUpdate {
  label: string | null;
  active: boolean;
}

export type EditorialStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type HomeMessageImportance =
  | 'INFORMATION'
  | 'WARNING'
  | 'QUEST_IMMINENT'
  | 'SUCCESS'
  | 'MYSTERY';

export interface AdminHomeMessage {
  id: string;
  title: string;
  contentMarkdown: string;
  importance: HomeMessageImportance;
  status: EditorialStatus;
  active: boolean;
  countdownEnabled: boolean;
  endsAt: string | null;
  expiredMessage: string | null;
  lastModifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminHomeMessageUpsert {
  title: string;
  contentMarkdown: string;
  importance: HomeMessageImportance;
  status: EditorialStatus;
  countdownEnabled: boolean;
  endsAt: string | null;
  expiredMessage: string | null;
}

export interface AdminCompany {
  id: string | null;
  name: string;
  emblemPath: string | null;
  imageAlt: string | null;
  shortDescription: string;
  longDescriptionMarkdown: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminCompanyUpdate {
  name: string;
  emblemPath: string | null;
  imageAlt: string | null;
  shortDescription: string;
  longDescriptionMarkdown: string;
}

export interface AdminAdventurer {
  id: string;
  name: string;
  title: string;
  avatarPath: string | null;
  avatarAlt: string | null;
  shortDescription: string;
  strengths: string;
  weaknesses: string;
  visible: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAdventurerUpsert {
  name: string;
  title: string;
  avatarPath: string | null;
  avatarAlt: string | null;
  shortDescription: string;
  strengths: string;
  weaknesses: string;
  visible: boolean;
  displayOrder: number;
}

export interface AdminMapVision {
  id: string;
  name: string;
  descriptionMarkdown: string;
  assetPath: string;
  imageAlt: string;
  displayOrder: number;
  status: EditorialStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMapVisionUpsert {
  name: string;
  descriptionMarkdown: string;
  assetPath: string;
  imageAlt: string;
  displayOrder: number;
  status: EditorialStatus;
}

export interface AdminMapMarker {
  id: string;
  questCode: string;
  title: string;
  positionX: number;
  positionY: number;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMapMarkerUpsert {
  questCode: string;
  title: string;
  positionX: number;
  positionY: number;
  active: boolean;
  displayOrder: number;
}

export interface AdminMapPreview {
  vision: AdminMapVision;
  markers: AdminMapMarker[];
}
