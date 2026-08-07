import { TestBed } from '@angular/core/testing';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';

describe('CloudflareAccessSessionService', () => {
  let service: CloudflareAccessSessionService;
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/radar', assign },
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudflareAccessSessionService);
  });

  afterEach(() => {
    // Les espions sont retirés ici et non en fin de test : une assertion qui échoue saute la
    // fin du test, et l'espion survivant ferait échouer le suivant pour une raison étrangère.
    vi.restoreAllMocks();
  });

  /**
   * Une expiration ne doit jamais faire partir l'utilisateur de sa page.
   *
   * Recharger d'office lui prendrait son écran sans qu'il l'ait demandé, alors qu'une bonne
   * part du site reste lisible hors session — les pages publiques sont servies depuis le cache
   * du service worker. Il voit le bandeau, et décide.
   */
  it('raises the banner without taking the user off their page', () => {
    service.reauthenticate();

    expect(service.reconnectRequired()).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  /**
   * L'appel est répété à chaque `401` tant que la session n'est pas rétablie : il doit rester
   * sans effet de bord. Rien ne navigue sans un clic, donc aucune boucle n'est possible.
   */
  it('stays inert when the same expiry is reported again', () => {
    service.reauthenticate();
    service.reauthenticate();
    service.reauthenticate();

    expect(service.reconnectRequired()).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  /**
   * Seul le chargement de l'identité du portail prouve qu'une session valide a été délivrée.
   * Le bandeau ne s'efface donc pas parce qu'une requête quelconque a réussi en parallèle.
   */
  it('lowers the banner only when a valid session is confirmed', () => {
    service.reauthenticate();
    expect(service.reconnectRequired()).toBe(true);

    service.confirmValidSession();

    expect(service.reconnectRequired()).toBe(false);
    expect(service.reconnecting()).toBe(false);
  });

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
    service.reauthenticate();

    service.retryNow();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://routes.example.invalid/radar?ngsw-bypass=1');
    expect(assign).not.toHaveBeenCalledWith('/cdn-cgi/access/logout');
  });

  /**
   * L'utilisateur doit voir que son clic a été pris en compte : le navigateur ne quitte pas la
   * page à l'instant de l'appel, et sans cet état le bandeau resterait identique.
   */
  it('shows the reconnection is under way', () => {
    service.reauthenticate();
    expect(service.reconnecting()).toBe(false);

    service.retryNow();

    expect(service.reconnecting()).toBe(true);
    // Le bandeau reste affiché jusqu'à la navigation, sans quoi l'écran n'annoncerait rien.
    expect(service.reconnectRequired()).toBe(true);
  });

  /**
   * L'état affiché ne doit jamais devenir une condition de blocage.
   *
   * Il ne retombe pas de lui-même — la page est censée partir — donc s'en servir pour refuser
   * le second clic laisserait le bouton mort dès que le départ n'a pas lieu : navigation
   * abandonnée, ou page restaurée depuis le cache de session avec son état d'avant. Le bouton
   * étant la seule issue offerte, il ne doit jamais devenir sa propre impasse.
   */
  it('stays usable when a first attempt left without going anywhere', () => {
    service.reauthenticate();
    service.retryNow();
    assign.mockClear();

    service.retryNow();

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
