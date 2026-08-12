import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicQuestDetail, PublicQuestSummary } from './notebook-api.models';
import { NotebookApiService } from './notebook-api.service';

const cachedQuests: PublicQuestSummary[] = [
  {
    id: 'quest-1',
    code: 'quete-1',
    title: 'La première route',
    summary: 'Un souvenir synchronisé.',
    displayOrder: 1,
  },
];

const cachedQuest: PublicQuestDetail = {
  ...cachedQuests[0],
  importantEventsHtml: '<p>Événement</p>',
  discoveredCluesHtml: '<p>Indice</p>',
  completedTrialsHtml: '<p>Épreuve</p>',
  extraContentHtml: '<p>Annexe</p>',
};

describe('NotebookApiService', () => {
  let http: HttpTestingController;
  let service: NotebookApiService;
  let cache: {
    shouldUseOfflineFallback: ReturnType<typeof vi.fn>;
    readQuests: ReturnType<typeof vi.fn>;
    readQuest: ReturnType<typeof vi.fn>;
    writeQuests: ReturnType<typeof vi.fn>;
    writeQuest: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cache = {
      shouldUseOfflineFallback: vi.fn(() => true),
      readQuests: vi.fn(() => Promise.resolve(cachedQuests)),
      readQuest: vi.fn(() => Promise.resolve(cachedQuest)),
      writeQuests: vi.fn(() => Promise.resolve()),
      writeQuest: vi.fn(() => Promise.resolve()),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PublicContentCacheService,
          useValue: cache,
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotebookApiService);
  });

  afterEach(() => {
    http.verify();
  });

  it('uses the cached quest list when the network request fails', async () => {
    const result = new Promise<PublicQuestSummary[]>((resolve, reject) =>
      service.listPublicQuests().subscribe({ next: resolve, error: reject }),
    );

    http.expectOne('/api/public/notebook').flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(result).resolves.toBe(cachedQuests);
  });

  it('uses the cached quest detail when the network request fails', async () => {
    const result = new Promise<PublicQuestDetail>((resolve, reject) =>
      service.getPublicQuest('quete-1').subscribe({ next: resolve, error: reject }),
    );

    http
      .expectOne('/api/public/notebook/quete-1')
      .flush({}, { status: 504, statusText: 'Gateway Timeout' });

    await expect(result).resolves.toBe(cachedQuest);
    expect(cache.readQuest).toHaveBeenCalledWith('quete-1');
  });

  it('keeps the original failure when no cached quest list exists', async () => {
    cache.readQuests.mockReturnValue(Promise.resolve(null));
    const result = new Promise<PublicQuestSummary[]>((resolve, reject) =>
      service.listPublicQuests().subscribe({ next: resolve, error: reject }),
    );

    http
      .expectOne('/api/public/notebook')
      .flush({}, { status: 502, statusText: 'Bad Gateway' });

    await expect(result).rejects.toMatchObject({ status: 502 });
  });
});
