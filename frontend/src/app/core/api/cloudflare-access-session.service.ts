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
 * et `/admin`, seules routes déjà exclues du cache.
 *
 * Le cache de navigation reste voulu par ailleurs : ce marqueur ne s'applique qu'aux
 * trajets d'authentification, qui n'ont aucun sens hors ligne.
 */
const SERVICE_WORKER_BYPASS = 'ngsw-bypass';

/**
 * Reprise de session Cloudflare Access.
 *
 * Une expiration ne fait jamais partir l'utilisateur de sa page : elle affiche un bandeau, et
 * c'est lui qui décide de se reconnecter. Recharger d'office lui prendrait son écran sans
 * l'avoir demandé, alors qu'une bonne part du site reste lisible hors session — les pages
 * publiques sont servies depuis le cache du service worker.
 *
 * Ce choix supprime aussi toute possibilité de boucle : rien ne navigue sans un clic. Le
 * verrou en `sessionStorage` qui l'empêchait autrefois n'a plus d'objet.
 */
@Injectable({ providedIn: 'root' })
export class CloudflareAccessSessionService {

  /** Vrai lorsqu'une session expirée a été constatée et n'a pas encore été rétablie. */
  readonly reconnectRequired = signal(false);

  /**
   * Vrai entre le clic sur la reconnexion et le départ effectif de la page.
   *
   * Le navigateur ne quitte pas la page à l'instant de l'appel : sans état visible, le bandeau
   * resterait identique pendant ce délai et le bouton paraîtrait inerte.
   *
   * Cet état n'interdit rien. Il ne retombe jamais de lui-même — la page est censée partir —
   * si bien qu'en faire une condition de blocage laisserait le bouton mort dès que le départ
   * n'a pas lieu : navigation abandonnée, ou page restaurée depuis le cache de session avec
   * son état d'avant. Le bouton étant la seule issue offerte à l'utilisateur, il ne doit
   * jamais pouvoir devenir sa propre impasse. Un second clic renavigue vers la même adresse,
   * ce qui est sans conséquence.
   */
  readonly reconnecting = signal(false);

  constructor() {
    this.forgetBypassMarker();
  }

  /**
   * Constate une session expirée.
   *
   * Appelé sur chaque `401` que Cloudflare renvoie sans le marqueur applicatif. L'appel est
   * donc répété tant que la session n'est pas rétablie : il doit rester sans effet de bord,
   * et se contenter de lever le bandeau.
   */
  reauthenticate(): void {
    this.reconnectRequired.set(true);
  }

  /**
   * Confirme une nouvelle session valide.
   *
   * Appelé uniquement lorsque l'identité du portail a pu être chargée, ce qui prouve que
   * Cloudflare Access a délivré une nouvelle session — jamais parce qu'une requête quelconque
   * a réussi en parallèle.
   */
  confirmValidSession(): void {
    this.reconnectRequired.set(false);
    this.reconnecting.set(false);
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
   */
  retryNow(): void {
    this.reconnecting.set(true);
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
}
