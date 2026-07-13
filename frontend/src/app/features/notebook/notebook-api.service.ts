import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
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
  private readonly cache = inject(PublicContentCacheService);

  listPublicQuests() {
    return this.http.get<PublicQuestSummary[]>('/api/public/notebook').pipe(
      catchError((error: unknown) => {
        if (!this.isNetworkError(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readQuests()).pipe(
          switchMap((quests) => (quests ? of(quests) : throwError(() => error))),
        );
      }),
    );
  }

  getPublicQuest(code: string) {
    return this.http.get<PublicQuestDetail>(`/api/public/notebook/${encodeURIComponent(code)}`).pipe(
      catchError((error: unknown) => {
        if (!this.isNetworkError(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readQuest(code)).pipe(
          switchMap((quest) => (quest ? of(quest) : throwError(() => error))),
        );
      }),
    );
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

  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }
}
