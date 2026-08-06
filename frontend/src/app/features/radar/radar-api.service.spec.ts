import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RadarApiService } from './radar-api.service';

describe('RadarApiService', () => {
  let service: RadarApiService;
  let http: HttpTestingController;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RadarApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('publishes a position with a PUT', () => {
    service
      .updateLocation({
        latitude: 46.1,
        longitude: -1.1,
        accuracyM: 6,
        observedAt: '2026-08-05T12:00:00.000Z',
      })
      .subscribe();

    const request = http.expectOne('/api/radar/me/location');

    expect(request.request.method).toBe('PUT');
    request.flush(null);
  });

  /**
   * Le départ part de `fetch` et non d'`HttpClient` : il doit survivre à la destruction du
   * composant qui vient de le déclencher. `keepalive` lui laisse une chance lors d'une
   * fermeture d'onglet, sans jamais la garantir.
   */
  it('announces the departure with a keepalive DELETE', () => {
    service.announceDeparture();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('/api/radar/me/location');
    expect(options.method).toBe('DELETE');
    expect(options.keepalive).toBe(true);
    expect(options.credentials).toBe('same-origin');
    expect((options.headers as Record<string, string>)['X-Requested-With']).toBe('XMLHttpRequest');
  });

  /** `HttpClient` n'est pas utilisé ici : le jeton CSRF doit être posé à la main. */
  it('carries the CSRF token read from the cookie', () => {
    document.cookie = 'XSRF-TOKEN=jeton%2Fpartage; path=/';

    service.announceDeparture();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect((options.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('jeton/partage');
  });

  it('omits the CSRF header when no cookie is available', () => {
    service.announceDeparture();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(options.headers as Record<string, string>).not.toHaveProperty('X-XSRF-TOKEN');
  });

  /** Le retrait immédiat n'est jamais garanti : le TTL serveur prend le relais. */
  it('swallows a failed departure', async () => {
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')));

    expect(() => service.announceDeparture()).not.toThrow();
    await Promise.resolve();
  });
});
