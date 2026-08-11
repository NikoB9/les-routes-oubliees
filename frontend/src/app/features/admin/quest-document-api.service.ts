import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { AdminQuestDocument } from './quest-document-api.models';

/**
 * Documents d'organisation des quêtes.
 *
 * Ce service vit dans la fonctionnalité d'administration, et non aux côtés des appels de quête
 * publics : ces derniers sont importés par le bloc-notes des joueurs, qui n'a rien à faire de
 * routes réservées à l'organisateur.
 */
@Injectable({ providedIn: 'root' })
export class QuestDocumentApiService {
  private readonly http = inject(HttpClient);

  listQuestDocuments(questCode: string) {
    return this.http.get<AdminQuestDocument[]>(this.documentsUrl(questCode));
  }

  uploadQuestDocument(questCode: string, file: File, label: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('label', label);
    return this.http.post<AdminQuestDocument>(this.documentsUrl(questCode), formData);
  }

  deleteQuestDocument(questCode: string, id: string) {
    return this.http.delete<void>(`${this.documentsUrl(questCode)}/${encodeURIComponent(id)}`);
  }

  private documentsUrl(questCode: string) {
    return `/api/admin/quest-tabs/${encodeURIComponent(questCode)}/documents`;
  }
}
