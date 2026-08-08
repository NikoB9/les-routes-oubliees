import { Injectable, signal } from '@angular/core';

/**
 * Chemin de reprise d'une session Cloudflare Access.
 *
 * Il est exclu de `navigationUrls` dans `ngsw-config.json` : le service worker ne le sert donc
 * jamais depuis son cache, et la navigation quitte réellement le navigateur. C'est la condition
 * sans laquelle Cloudflare ne voit jamais la requête et ne peut redemander aucune
 * authentification — ce qui rendait la reconnexion inopérante partout sauf sur `/radar` et
 * `/admin`, seules routes déjà exclues.
 */
export const ACCESS_RECONNECT_PATH = '/reconnexion';

/** Paramètre portant l'adresse à retrouver une fois la session rétablie. */
export const ACCESS_RETURN_PARAM = 'retour';

/**
 * État de la session Cloudflare Access.
 *
 * Ce service ne navigue jamais. Constater l'expiration et reprendre la session sont deux choses
 * distinctes : la première est automatique, la seconde appartient à l'utilisateur, qui suit un
 * lien ordinaire. Rien ne partant sans un clic, aucune boucle de rechargement n'est possible et
 * le verrou en `sessionStorage` qui l'empêchait autrefois n'a plus d'objet.
 */
@Injectable({ providedIn: 'root' })
export class CloudflareAccessSessionService {
  /** Vrai dès qu'un `401` Cloudflare a été constaté, jusqu'à confirmation d'une session valide. */
  readonly sessionExpired = signal(false);

  /**
   * Constate une session expirée.
   *
   * Appelé sur chaque `401` que Cloudflare renvoie sans le marqueur applicatif, donc plusieurs
   * fois par expiration : la méthode doit rester sans effet de bord.
   */
  noteExpiredSession(): void {
    this.sessionExpired.set(true);
  }

  /**
   * Confirme une nouvelle session valide.
   *
   * Appelé uniquement lorsque l'identité du portail a pu être chargée, ce qui prouve que
   * Cloudflare Access a délivré une session — jamais parce qu'une requête quelconque a réussi
   * en parallèle.
   */
  confirmValidSession(): void {
    this.sessionExpired.set(false);
  }

  /** Adresse du lien de reconnexion depuis la page consultée. */
  reconnectHref(currentUrl: string): string {
    const destination = safeReturnUrl(currentUrl);
    return `${ACCESS_RECONNECT_PATH}?${ACCESS_RETURN_PARAM}=${encodeURIComponent(destination)}`;
  }
}

/**
 * Adresse de retour acceptable.
 *
 * Seule une route de ce site est admise. La reprise se fait aujourd'hui par le routeur Angular,
 * qui ne quitterait de toute façon pas l'origine ; la validation protège le jour où elle passerait
 * par une navigation réelle, où `//hôte` et `https://hôte` deviendraient des redirections
 * ouvertes.
 *
 * Les caractères de contrôle sont retirés d'abord : les navigateurs les suppriment des adresses,
 * si bien qu'une valeur telle que `/<tab>/ailleurs` redeviendrait `//ailleurs` après coup.
 */
export function safeReturnUrl(value: string | null | undefined): string {
  const fallback = '/';
  if (!value) {
    return fallback;
  }
  const cleaned = value.replace(/\p{Cc}/gu, '');
  if (!cleaned.startsWith('/') || cleaned.startsWith('//') || cleaned.startsWith('/\\')) {
    return fallback;
  }
  // Le chemin de reprise ne peut pas être sa propre destination.
  if (cleaned === ACCESS_RECONNECT_PATH || cleaned.startsWith(`${ACCESS_RECONNECT_PATH}?`)) {
    return fallback;
  }
  return cleaned;
}
