import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import {
  AdminQuest,
  AdminQuestPreview,
  AdminQuestUpdate,
  PublicQuestDetail,
  PublicQuestSummary,
} from './notebook-api.models';

@Injectable({ providedIn: 'root' })
export class NotebookApiService {
  private readonly http = inject(HttpClient);

  listPublicQuests() {
    return this.http.get<PublicQuestSummary[]>('/api/public/notebook');
  }

  getPublicQuest(code: string) {
    return this.http.get<PublicQuestDetail>(`/api/public/notebook/${encodeURIComponent(code)}`);
  }

  listAdminQuests() {
    return this.http.get<AdminQuest[]>('/api/admin/quest-tabs');
  }

  getAdminQuest(code: string) {
    return this.http.get<AdminQuest>(`/api/admin/quest-tabs/${encodeURIComponent(code)}`);
  }

  updateAdminQuest(code: string, payload: AdminQuestUpdate) {
    return this.http.put<AdminQuest>(`/api/admin/quest-tabs/${encodeURIComponent(code)}`, payload);
  }

  previewAdminQuest(payload: AdminQuestUpdate) {
    return this.http.post<AdminQuestPreview>('/api/admin/quest-tabs/preview', payload);
  }

  publishAdminQuest(code: string, visibleToPlayers = true) {
    return this.http.post<AdminQuest>(`/api/admin/quest-tabs/${encodeURIComponent(code)}/publish`, {
      visibleToPlayers,
    });
  }

  hideAdminQuest(code: string) {
    return this.http.post<AdminQuest>(`/api/admin/quest-tabs/${encodeURIComponent(code)}/hide`, {});
  }

  archiveAdminQuest(code: string) {
    return this.http.post<AdminQuest>(`/api/admin/quest-tabs/${encodeURIComponent(code)}/archive`, {});
  }
}
