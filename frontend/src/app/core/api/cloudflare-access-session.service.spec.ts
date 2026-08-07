import { TestBed } from '@angular/core/testing';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';

describe('CloudflareAccessSessionService', () => {
  let service: CloudflareAccessSessionService;
  let assign: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/radar', assign },
    });
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudflareAccessSessionService);
  });

  afterEach(() => {
    // Les espions sont retires ici et non en fin de test : une assertion qui echoue saute la
    // fin du test, et l'espion survivant ferait echouer le suivant pour une raison etrangere.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('reloads the page once on the first Access expiry', () => {
    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://routes.example.invalid/radar?ngsw-bypass=1');
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

  /** Amène le service à l'état où le bandeau de reconnexion est affiché. */
  function reachReconnectBanner() {
    service.reauthenticate();
    service.reauthenticate();
    expect(service.reconnectRequired()).toBe(true);
    assign.mockClear();
  }

  /**
   * Une navigation qui atteint le réseau suffit : privée de session valide, elle reçoit de
   * Cloudflare sa redirection vers l'authentification.
   *
   * Aucune déconnexion n'est demandée au passage. Elle l'a été tant que la cause était mal
   * comprise, et elle faisait atterrir sur `/?__cf_access_message=logged_out` — une adresse
   * choisie par Cloudflare, que l'application ne peut pas marquer, donc interceptée par le
   * service worker, et dont le premier chargement échouait en `ERR_FAILED`.
   */
  it('reloads through the network without touching the logout endpoint', () => {
    reachReconnectBanner();

    service.retryNow();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://routes.example.invalid/radar?ngsw-bypass=1');
    expect(assign).not.toHaveBeenCalledWith('/cdn-cgi/access/logout');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * L'utilisateur doit voir que son clic a été pris en compte : le navigateur ne quitte pas la
   * page à l'instant de l'appel, et sans cet état le bandeau resterait identique. Un second
   * clic ne doit pas relancer une navigation déjà demandée.
   */
  it('shows the reconnection is under way and ignores a second click', () => {
    reachReconnectBanner();
    expect(service.reconnecting()).toBe(false);

    service.retryNow();
    service.retryNow();

    expect(service.reconnecting()).toBe(true);
    // Le bandeau reste affiché jusqu'à la navigation, sans quoi l'écran n'annoncerait rien.
    expect(service.reconnectRequired()).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  /**
   * Le verrou est relâché pour le chargement suivant : sans cela la session d'après serait
   * privée de son rechargement automatique et afficherait le bandeau dès la première
   * expiration.
   */
  it('frees the stored lock so the next page load gets its automatic reload back', () => {
    reachReconnectBanner();

    service.retryNow();

    expect(sessionStorage.getItem('lro.cloudflare-reauth.v1')).toBeNull();

    // Nouvelle instance : c'est l'état que retrouve la page servie après l'identification.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(CloudflareAccessSessionService);
    assign.mockClear();

    reloaded.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://routes.example.invalid/radar?ngsw-bypass=1');
  });

  /**
   * Le défaut qui rendait la reconnexion inopérante partout sauf sur `/radar`.
   *
   * `navigationUrls` couvre l'accueil et le carnet : leurs navigations reçoivent la coquille
   * depuis le cache du service worker, donc elles ne quittent pas le navigateur. Cloudflare
   * ne les voit jamais et ne peut redemander aucune authentification — l'utilisateur revient
   * au même écran. Une reconnexion demandée explicitement doit aboutir quelle que soit la
   * page, le marqueur est donc posé sur l'adresse d'une page mise en cache aussi.
   *
   * Il est ajouté aux paramètres existants, jamais substitué à eux : la page rejointe est
   * celle que l'utilisateur consultait, arguments compris.
   */
  it('reaches the network from a cached page, keeping the address intact', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/carnet?quete=7', assign },
    });
    reachReconnectBanner();

    service.retryNow();

    expect(assign).toHaveBeenCalledWith(
      'https://routes.example.invalid/carnet?quete=7&ngsw-bypass=1',
    );
  });

  /**
   * Le marqueur n'a de sens que pour la requête qui l'a porté. Le laisser le ferait suivre
   * l'utilisateur dans sa navigation, ses favoris et ses partages, et priverait de cache
   * chaque retour sur la page.
   */
  it('drops the bypass marker from the address once the page is served', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const state: unknown = window.history.state;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/carnet?quete=7&ngsw-bypass=1', assign },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    TestBed.inject(CloudflareAccessSessionService);

    // L'état d'historique est repris tel quel : la réécriture ne porte que sur l'adresse.
    expect(replaceState).toHaveBeenCalledWith(
      state,
      '',
      'https://routes.example.invalid/carnet?quete=7',
    );
  });

  /** Une adresse ordinaire ne doit pas être réécrite pour autant. */
  it('leaves an untouched address alone', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    TestBed.inject(CloudflareAccessSessionService);

    expect(replaceState).not.toHaveBeenCalled();
  });
});
