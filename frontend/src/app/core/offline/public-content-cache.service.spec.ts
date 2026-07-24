import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicContentCacheService } from './public-content-cache.service';

describe('PublicContentCacheService', () => {
  let service: PublicContentCacheService;

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });

    service = TestBed.inject(PublicContentCacheService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses offline fallback for service worker gateway timeout responses', () => {
    expect(
      service.shouldUseOfflineFallback(
        new HttpErrorResponse({
          status: 504,
          statusText: 'Gateway Timeout',
        }),
      ),
    ).toBe(true);
  });

  it('does not use offline fallback for regular server errors while online', () => {
    expect(
      service.shouldUseOfflineFallback(
        new HttpErrorResponse({
          status: 500,
          statusText: 'Server Error',
        }),
      ),
    ).toBe(false);
  });
});
