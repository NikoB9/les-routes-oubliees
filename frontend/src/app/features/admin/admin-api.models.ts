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
