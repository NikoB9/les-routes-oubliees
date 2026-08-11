import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QuestDocumentApiService } from './quest-document-api.service';

describe('QuestDocumentApiService', () => {
  let service: QuestDocumentApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(QuestDocumentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists the documents of a quest under the administration API', () => {
    service.listQuestDocuments('QUEST_1').subscribe();

    const request = http.expectOne('/api/admin/quest-tabs/QUEST_1/documents');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('sends the file and its label as multipart form data', () => {
    const file = new File(['%PDF-'], 'organisation.pdf', { type: 'application/pdf' });

    service.uploadQuestDocument('QUEST_2', file, 'Feuille de route').subscribe();

    const request = http.expectOne('/api/admin/quest-tabs/QUEST_2/documents');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('label')).toBe('Feuille de route');
    expect(body.get('file')).toBe(file);
    request.flush({});
  });

  it('deletes a document of its own quest', () => {
    const id = '90000000-0000-0000-0000-000000000001';

    service.deleteQuestDocument('QUEST_3', id).subscribe();

    const request = http.expectOne(`/api/admin/quest-tabs/QUEST_3/documents/${id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  /**
   * Les deux segments viennent de la route et de la base : un code inattendu ne doit pas pouvoir
   * s'échapper du chemin.
   */
  it('escapes the quest code and the document identifier', () => {
    service.listQuestDocuments('QUEST 1/../media').subscribe();

    http.expectOne('/api/admin/quest-tabs/QUEST%201%2F..%2Fmedia/documents').flush([]);
  });
});
