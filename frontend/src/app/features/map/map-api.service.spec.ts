import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicMapResponse } from './map-api.models';
import { MapApiService } from './map-api.service';

const cachedMap: PublicMapResponse = {
  vision: null,
  markers: [],
};

describe('MapApiService', () => {
  let http: HttpTestingController;
  let service: MapApiService;
  let cache: {
    shouldUseOfflineFallback: ReturnType<typeof vi.fn>;
    readMap: ReturnType<typeof vi.fn>;
    writeMap: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cache = {
      shouldUseOfflineFallback: vi.fn(() => true),
      readMap: vi.fn(() => Promise.resolve(cachedMap)),
      writeMap: vi.fn(() => Promise.resolve()),
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
    service = TestBed.inject(MapApiService);
  });

  afterEach(() => {
    http.verify();
  });

  it('uses the cached public snapshot when the network request fails', async () => {
    const result = new Promise<PublicMapResponse>((resolve, reject) =>
      service.getMap().subscribe({ next: resolve, error: reject }),
    );

    http.expectOne('/api/public/map').flush({}, { status: 502, statusText: 'Bad Gateway' });

    await expect(result).resolves.toBe(cachedMap);
  });

  it('keeps the original failure when no cached map exists', async () => {
    cache.readMap.mockReturnValue(Promise.resolve(null));
    const result = new Promise<PublicMapResponse>((resolve, reject) =>
      service.getMap().subscribe({ next: resolve, error: reject }),
    );

    http.expectOne('/api/public/map').flush({}, { status: 503, statusText: 'Service Unavailable' });

    await expect(result).rejects.toMatchObject({ status: 503 });
  });
});
