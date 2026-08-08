import { TestBed } from '@angular/core/testing';

import {
  ACCESS_RECONNECT_PATH,
  CloudflareAccessSessionService,
  safeReturnUrl,
} from './cloudflare-access-session.service';

describe('CloudflareAccessSessionService', () => {
  let service: CloudflareAccessSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudflareAccessSessionService);
  });

  it('starts with a session assumed valid', () => {
    expect(service.sessionExpired()).toBe(false);
  });

  /** L'intercepteur appelle sur chaque `401` : l'appel doit rester sans effet de bord. */
  it('records the expiry and stays idempotent across a burst of 401s', () => {
    service.noteExpiredSession();
    service.noteExpiredSession();
    service.noteExpiredSession();

    expect(service.sessionExpired()).toBe(true);
  });

  it('clears the expiry only when a valid session is confirmed', () => {
    service.noteExpiredSession();
    service.confirmValidSession();

    expect(service.sessionExpired()).toBe(false);
  });

  /**
   * Garde central du correctif : le service ne navigue jamais de lui-même. C'est ce qui rend
   * toute boucle de rechargement impossible, et ce qui laisse la reprise à un lien ordinaire —
   * seule forme de navigation que le service worker laisse atteindre le réseau.
   */
  it('never navigates by itself', () => {
    const assign = vi.fn();
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/', assign },
    });

    try {
      service.noteExpiredSession();
      service.confirmValidSession();

      expect(assign).not.toHaveBeenCalled();
    }
    finally {
      if (original) {
        Object.defineProperty(window, 'location', original);
      }
    }
  });

  it('carries the consulted page as the return address', () => {
    expect(service.reconnectHref('/notebook/quete-1')).toBe(
      `${ACCESS_RECONNECT_PATH}?retour=%2Fnotebook%2Fquete-1`,
    );
  });

  it('never sends the recovery page back to itself', () => {
    expect(service.reconnectHref(`${ACCESS_RECONNECT_PATH}?retour=%2Fmap`)).toBe(
      `${ACCESS_RECONNECT_PATH}?retour=%2F`,
    );
  });

  describe('safeReturnUrl', () => {
    it('keeps a route of this site', () => {
      expect(safeReturnUrl('/map')).toBe('/map');
      expect(safeReturnUrl('/notebook/quete-1?page=2')).toBe('/notebook/quete-1?page=2');
    });

    it('refuses anything that could leave the site', () => {
      expect(safeReturnUrl('//ailleurs.example')).toBe('/');
      expect(safeReturnUrl('https://ailleurs.example')).toBe('/');
      expect(safeReturnUrl('/\\ailleurs.example')).toBe('/');
      expect(safeReturnUrl('javascript:alert(1)')).toBe('/');
      expect(safeReturnUrl('map')).toBe('/');
    });

    /** Le navigateur retire les caractères de contrôle : `/\t/ailleurs` deviendrait `//ailleurs`. */
    it('refuses an address the browser would rewrite into an absolute one', () => {
      expect(safeReturnUrl('/\t/ailleurs.example')).toBe('/');
      expect(safeReturnUrl('/\n/ailleurs.example')).toBe('/');
    });

    it('falls back on a missing address', () => {
      expect(safeReturnUrl(null)).toBe('/');
      expect(safeReturnUrl(undefined)).toBe('/');
      expect(safeReturnUrl('')).toBe('/');
    });
  });
});
