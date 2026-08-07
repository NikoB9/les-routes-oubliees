import { TestBed } from '@angular/core/testing';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';

describe('CloudflareAccessSessionService', () => {
  let service: CloudflareAccessSessionService;
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/radar', assign },
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudflareAccessSessionService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('reloads the page once on the first Access expiry', () => {
    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://routes.example.invalid/radar');
    expect(service.reconnectRequired()).toBe(false);
  });

  it('never reloads twice and offers a stable reconnection action instead', () => {
    service.reauthenticate();
    service.reauthenticate();
    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(service.reconnectRequired()).toBe(true);
  });

  it('keeps the lock across a page load until a valid session is confirmed', () => {
    service.reauthenticate();
    expect(assign).toHaveBeenCalledTimes(1);

    // Nouvelle instance : le verrou survit dans sessionStorage.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(CloudflareAccessSessionService);

    reloaded.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(reloaded.reconnectRequired()).toBe(true);
  });

  it('clears the lock only when a valid session is confirmed', () => {
    service.reauthenticate();
    service.confirmValidSession();

    expect(service.reconnectRequired()).toBe(false);

    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('still prevents a loop when sessionStorage is unavailable', () => {
    // Stockage refusé : seul le verrou mémoire peut empêcher la boucle.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restricted = TestBed.inject(CloudflareAccessSessionService);

    restricted.reauthenticate();
    restricted.reauthenticate();
    restricted.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(restricted.reconnectRequired()).toBe(true);

    vi.restoreAllMocks();
  });

  /**
   * Le bandeau n'apparaît qu'après un rechargement resté sans effet. Recharger de nouveau
   * referait donc ce qui vient d'échouer : le bouton semblerait inerte, le bandeau revenant
   * seulement au `401` suivant. La reconnexion doit sortir de la session, pas la rejouer.
   */
  it('leaves the Access session instead of repeating the reload that just failed', () => {
    service.reauthenticate();
    service.reauthenticate();
    expect(service.reconnectRequired()).toBe(true);

    service.retryNow();

    expect(assign).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenLastCalledWith('/cdn-cgi/access/logout');
    expect(assign).not.toHaveBeenLastCalledWith('https://routes.example.invalid/radar');
    expect(service.reconnectRequired()).toBe(false);
  });

  /**
   * Sortir sans relâcher le verrou laisserait la session suivante privée de son rechargement
   * automatique : la première expiration afficherait le bandeau au lieu de se rétablir seule.
   */
  it('frees the lock so the next expiry gets its automatic reload back', () => {
    service.reauthenticate();
    service.reauthenticate();
    service.retryNow();

    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(3);
    expect(assign).toHaveBeenLastCalledWith('https://routes.example.invalid/radar');
    expect(service.reconnectRequired()).toBe(false);
  });
});
