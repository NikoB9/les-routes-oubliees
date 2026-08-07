import { Injectable, signal } from '@angular/core';

/**
 * Point de sortie d'une session Cloudflare Access.
 *
 * Servi par l'edge Cloudflare et jamais par l'application, d'où le motif négatif
 * `!/cdn-cgi/**` de `ngsw-config.json` : sans lui le service worker répondrait la coquille
 * depuis son cache et la requête ne quitterait pas le navigateur.
 */
export const CLOUDFLARE_ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout';

/**
 * Marqueur qui fait traverser le service worker à une navigation.
 *
 * ngsw le reconnaît et laisse alors partir la requête sur le réseau. Sans lui, toute
 * navigation couverte par `navigationUrls` reçoit la coquille depuis le cache : elle ne
 * quitte pas le navigateur, Cloudflare ne la voit jamais, et aucune authentification ne peut
 * être redemandée. C'est ce qui rendait la reconnexion inopérante partout sauf sur `/radar`
 * et `/admin`, seules routes déjà exclues du cache — et qui faisait apparaître le bandeau
 * ailleurs, le rechargement automatique échouant pour exactement la même raison.
 *
 * Le cache de navigation reste voulu par ailleurs : ce marqueur ne s'applique qu'aux
 * trajets d'authentification, qui n'ont aucun sens hors ligne.
 */
const SERVICE_WORKER_BYPASS = 'ngsw-bypass';

/**
 * Reprise de session Cloudflare Access.
 *
 * Un rechargement de page permet à Cloudflare de rejouer son parcours d'authentification
 * lorsque la session Access a expiré. Le verrou conservé dans `sessionStorage` garantit
 * qu'un seul rechargement est déclenché par expiration : il n'est levé que lorsqu'une
 * nouvelle session valide est explicitement confirmée, jamais parce qu'une requête
 * quelconque a réussi en parallèle.
 */
@Injectable({ providedIn: 'root' })
export class CloudflareAccessSessionService {
  private readonly reauthKey = 'lro.cloudflare-reauth.v1';

  /** Vrai lorsqu'un rechargement a déjà été tenté sans rétablir la session. */
  readonly reconnectRequired = signal(false);

  /**
   * Vrai entre le clic sur la reconnexion et le départ effectif de la page.
   *
   * Le navigateur ne quitte pas la page à l'instant de l'appel : sans état visible, le bandeau
   * resterait identique pendant ce délai et le bouton paraîtrait inerte — le défaut même que
   * la reconnexion vient corriger. Il neutralise aussi les clics répétés.
   */
  readonly reconnecting = signal(false);

  /**
   * Verrou mémoire de secours.
   *
   * `sessionStorage` peut être indisponible (navigation restreinte, stockage désactivé) :
   * sans ce drapeau, chaque `401` relancerait un rechargement et créerait la boucle que le
   * verrou doit empêcher.
   */
  private pendingInMemory = false;

  constructor() {
    this.forgetBypassMarker();
  }

  reauthenticate(): void {
    if (this.isPending()) {
      // Deuxième expiration alors que le verrou est actif : proposer une action stable
      // plutôt que de recharger en boucle.
      this.reconnectRequired.set(true);
      return;
    }
    this.markPending();
    window.location.assign(this.networkUrl(window.location.href));
  }

  /**
   * Confirme une nouvelle session valide.
   *
   * Appelé uniquement lorsque l'identité du portail a pu être chargée, ce qui prouve que
   * Cloudflare Access a délivré une nouvelle session.
   */
  confirmValidSession(): void {
    this.reconnectRequired.set(false);
    this.reconnecting.set(false);
    this.releaseLock();
  }

  /**
   * Relance le parcours Cloudflare Access à la demande de l'utilisateur.
   *
   * Une navigation ordinaire suffit, dès lors qu'elle atteint le réseau : privée de session
   * valide, elle reçoit de Cloudflare sa redirection vers l'authentification, puis revient sur
   * l'adresse d'origine. Ce qui la rendait inopérante n'était pas la navigation mais le
   * service worker, qui la servait depuis son cache sans qu'elle quitte le navigateur.
   *
   * Aucune déconnexion préalable n'est demandée. Elle l'a été tant que la cause était mal
   * comprise, et elle coûtait cher : Cloudflare renvoie alors sur une adresse qu'il choisit
   * lui-même — `/?__cf_access_message=logged_out` — que l'application ne peut pas marquer, que
   * le service worker intercepte donc, et dont le premier chargement échouait en
   * `ERR_FAILED`. Il fallait recharger à la main pour repartir.
   *
   * Le verrou est relâché avant de partir, pour que la prochaine expiration retrouve son
   * rechargement automatique.
   */
  retryNow(): void {
    if (this.reconnecting()) {
      return;
    }
    this.reconnecting.set(true);
    this.releaseLock();
    window.location.assign(this.networkUrl(window.location.href));
  }

  /**
   * Adresse à demander au réseau plutôt qu'au service worker.
   *
   * Une URL illisible est rendue telle quelle : la navigation vaut mieux que rien, et sur
   * `/radar` comme sur `/admin` elle suffit de toute façon.
   */
  private networkUrl(href: string): string {
    try {
      const url = new URL(href, window.location.origin);
      url.searchParams.set(SERVICE_WORKER_BYPASS, '1');
      return url.toString();
    }
    catch {
      return href;
    }
  }

  /**
   * Retire le marqueur de l'adresse une fois la page servie.
   *
   * Il n'a de sens que pour la requête qui l'a porté. Le laisser le ferait suivre
   * l'utilisateur dans sa navigation, ses favoris et ses partages, et priverait de cache
   * chaque retour sur la page. `replaceState` ne recharge rien et n'ajoute pas d'entrée à
   * l'historique : le bouton « précédent » reste intact.
   */
  private forgetBypassMarker(): void {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(SERVICE_WORKER_BYPASS)) {
        return;
      }
      url.searchParams.delete(SERVICE_WORKER_BYPASS);
      window.history.replaceState(window.history.state, '', url.toString());
    }
    catch {
      // Historique indisponible : le marqueur reste visible, sans conséquence fonctionnelle.
    }
  }

  private releaseLock(): void {
    this.pendingInMemory = false;
    try {
      sessionStorage.removeItem(this.reauthKey);
    }
    catch {
      // Stockage indisponible : le verrou mémoire suffit pour ce chargement de page.
    }
  }

  private isPending(): boolean {
    if (this.reconnectRequired() || this.pendingInMemory) {
      return true;
    }
    try {
      return sessionStorage.getItem(this.reauthKey) === 'pending';
    }
    catch {
      return false;
    }
  }

  private markPending(): void {
    this.pendingInMemory = true;
    try {
      sessionStorage.setItem(this.reauthKey, 'pending');
    }
    catch {
      // Stockage indisponible : un rechargement au plus reste tenté par chargement de page.
    }
  }
}
