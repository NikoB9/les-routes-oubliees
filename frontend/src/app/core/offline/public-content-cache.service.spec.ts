import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicOfflineSnapshot } from './public-offline.models';
import { PublicContentCacheService } from './public-content-cache.service';

interface PublicContentCacheInternals {
  prefetchMedia: (snapshot: PublicOfflineSnapshot) => Promise<void>;
}

/**
 * Instantané réduit au strict nécessaire : le rapatriement balaie le JSON sérialisé, il ne
 * dépend d'aucun champ en particulier.
 */
function snapshotContaining(fragments: Record<string, unknown>): PublicOfflineSnapshot {
  return fragments as unknown as PublicOfflineSnapshot;
}

function withServiceWorkerController(controller: object | null): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller },
  });
}

describe('PublicContentCacheService', () => {
  let service: PublicContentCacheService;
  let internals: PublicContentCacheInternals;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });

    service = TestBed.inject(PublicContentCacheService);
    internals = service as unknown as PublicContentCacheInternals;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  /**
   * Les images sont référencées de deux façons — un champ de chemin, ou une balise dans le
   * HTML Markdown déjà rendu — et les deux doivent être rapatriées, sans quoi la page Carte
   * ou le Carnet resteraient troués hors ligne.
   */
  it('fetches every media referenced by the snapshot, wherever it appears', async () => {
    withServiceWorkerController({});

    await internals.prefetchMedia(
      snapshotContaining({
        settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
        map: { vision: { assetPath: '/media/22222222-2222-2222-2222-222222222222' } },
        questDetails: [
          {
            extraContentHtml:
              '<img src="/media/33333333-3333-3333-3333-333333333333" alt="Sceau">',
          },
        ],
      }),
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/media/11111111-1111-1111-1111-111111111111',
      '/media/22222222-2222-2222-2222-222222222222',
      '/media/33333333-3333-3333-3333-333333333333',
    ]);
  });

  it('never fetches the same media twice', async () => {
    withServiceWorkerController({});

    await internals.prefetchMedia(
      snapshotContaining({
        settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
        home: { company: { emblemPath: '/media/11111111-1111-1111-1111-111111111111' } },
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** Sans service worker aux commandes, aucun cache ne recueillerait les réponses. */
  it('does not fetch anything when no service worker controls the page', async () => {
    withServiceWorkerController(null);

    await internals.prefetchMedia(
      snapshotContaining({
        settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * Au premier chargement, le service worker n'a pas encore la main : Angular ne l'enregistre
   * qu'une fois l'application stabilisée. Renoncer définitivement à ce moment-là, alors que
   * les visites suivantes trouvent la version inchangée, ne rapatrierait jamais aucun média.
   */
  it('retries the prefetch once the service worker takes control', async () => {
    const snapshot = snapshotContaining({
      version: 'v1',
      settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
    });

    withServiceWorkerController(null);
    await internals.prefetchMedia(snapshot);
    expect(fetchMock).not.toHaveBeenCalled();

    withServiceWorkerController({});
    await internals.prefetchMedia(snapshot);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** Une navigation ne doit pas relancer le rapatriement d'un instantané déjà traité. */
  it('prefetches a given version only once', async () => {
    withServiceWorkerController({});
    const snapshot = snapshotContaining({
      version: 'v1',
      settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
    });

    await internals.prefetchMedia(snapshot);
    await internals.prefetchMedia(snapshot);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('prefetches again when the content version changes', async () => {
    withServiceWorkerController({});

    await internals.prefetchMedia(
      snapshotContaining({
        version: 'v1',
        settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
      }),
    );
    await internals.prefetchMedia(
      snapshotContaining({
        version: 'v2',
        settings: { logoPath: '/media/22222222-2222-2222-2222-222222222222' },
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /** Un média supprimé entre-temps ne doit jamais faire échouer le rafraîchissement. */
  it('survives a media that can no longer be fetched', async () => {
    withServiceWorkerController({});
    fetchMock.mockRejectedValue(new Error('network'));

    await expect(
      internals.prefetchMedia(
        snapshotContaining({
          settings: { logoPath: '/media/11111111-1111-1111-1111-111111111111' },
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
