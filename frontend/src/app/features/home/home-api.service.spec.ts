import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicHomeResponse } from './home-api.models';
import { HomeApiService } from './home-api.service';

const cachedHome: PublicHomeResponse = {
  message: null,
  company: null,
  adventurers: [],
};

describe('HomeApiService', () => {
  let http: HttpTestingController;
  let service: HomeApiService;
  let cache: {
    shouldUseOfflineFallback: ReturnType<typeof vi.fn>;
    readHome: ReturnType<typeof vi.fn>;
    writeHome: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cache = {
      shouldUseOfflineFallback: vi.fn(() => true),
      readHome: vi.fn(() => Promise.resolve(cachedHome)),
      writeHome: vi.fn(() => Promise.resolve()),
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
    service = TestBed.inject(HomeApiService);
  });

  afterEach(() => {
    http.verify();
  });

  it('uses the cached public snapshot when the network request fails', async () => {
    const result = new Promise<PublicHomeResponse>((resolve, reject) =>
      service.getHome().subscribe({ next: resolve, error: reject }),
    );

    http.expectOne('/api/public/home').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(result).resolves.toBe(cachedHome);
  });

  it('keeps the original failure when no cached home exists', async () => {
    cache.readHome.mockReturnValue(Promise.resolve(null));
    const result = new Promise<PublicHomeResponse>((resolve, reject) =>
      service.getHome().subscribe({ next: resolve, error: reject }),
    );

    http.expectOne('/api/public/home').flush({}, { status: 504, statusText: 'Gateway Timeout' });

    await expect(result).rejects.toMatchObject({ status: 504 });
  });
});
