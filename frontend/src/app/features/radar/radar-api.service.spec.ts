import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RadarApiService } from './radar-api.service';
import { RadarSnapshot, RadarStreamEvent } from './radar.models';

describe('RadarApiService', () => {
  let service: RadarApiService;
  let http: HttpTestingController;
  let fetchMock: ReturnType<typeof vi.fn>;

  const snapshot: RadarSnapshot = {
    serverTime: '2026-08-06T12:00:00Z',
    currentIdentity: null,
    treasure: null,
    points: [],
    participants: [],
  };

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

  describe('events', () => {
    let source: FakeEventSource;

    beforeEach(() => {
      vi.stubGlobal('EventSource', FakeEventSource);
      FakeEventSource.instances = [];
    });

    /** Souscrit et rend le flux créé par le service. */
    function subscribeEvents(observer: {
      next?: (event: RadarStreamEvent) => void;
      error?: (error: unknown) => void;
    }) {
      const subscription = service.events().subscribe(observer);
      source = FakeEventSource.instances[0];
      return subscription;
    }

    it('emits the snapshot carried by the stream', () => {
      const received: RadarStreamEvent[] = [];
      subscribeEvents({ next: (event) => received.push(event) });

      source.emit('snapshot', JSON.stringify(snapshot));

      expect(source.url).toBe('/api/radar/events');
      expect(received).toEqual([{ kind: 'snapshot', snapshot }]);
    });

    it('reports the stream as connected when it opens', () => {
      const received: RadarStreamEvent[] = [];
      subscribeEvents({ next: (event) => received.push(event) });

      source.emit('open');

      expect(received).toEqual([{ kind: 'connected' }]);
    });

    /**
     * Cœur du correctif : fermer le flux dans `onerror` annulait la reconnexion automatique
     * d'`EventSource`, et le client restait en sondage pour le reste de la session. Une
     * coupure transitoire ne doit donc ni fermer le flux ni terminer l'observable.
     */
    it('lets the browser reconnect after a transient failure', () => {
      const received: RadarStreamEvent[] = [];
      const error = vi.fn();
      subscribeEvents({ next: (event) => received.push(event), error });

      source.readyState = FakeEventSource.CONNECTING;
      source.onerror?.(new Event('error'));

      expect(received).toEqual([{ kind: 'reconnecting' }]);
      expect(error).not.toHaveBeenCalled();
      expect(source.close).not.toHaveBeenCalled();
    });

    /** `CLOSED` signifie que le navigateur ne réessaiera pas : la coupure est définitive. */
    it('fails the observable when the browser gives up', () => {
      const error = vi.fn();
      subscribeEvents({ error });

      source.readyState = FakeEventSource.CLOSED;
      source.onerror?.(new Event('error'));

      expect(error).toHaveBeenCalledTimes(1);
    });

    it('closes the stream on unsubscription', () => {
      const subscription = subscribeEvents({});

      subscription.unsubscribe();

      expect(source.close).toHaveBeenCalledTimes(1);
    });
  });
});

/** `EventSource` n'existe pas dans jsdom : ce double en reproduit le contrat utilisé. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.OPEN;
  onerror: ((event: Event) => void) | null = null;
  readonly close = vi.fn();

  private readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(type: string, data = '') {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent<string>(type, { data }));
    }
  }
}
