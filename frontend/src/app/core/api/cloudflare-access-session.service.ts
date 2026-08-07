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
   * Verrou mémoire de secours.
   *
   * `sessionStorage` peut être indisponible (navigation restreinte, stockage désactivé) :
   * sans ce drapeau, chaque `401` relancerait un rechargement et créerait la boucle que le
   * verrou doit empêcher.
   */
  private pendingInMemory = false;

  reauthenticate(): void {
    if (this.isPending()) {
      // Deuxième expiration alors que le verrou est actif : proposer une action stable
      // plutôt que de recharger en boucle.
      this.reconnectRequired.set(true);
      return;
    }
    this.markPending();
    window.location.assign(window.location.href);
  }

  /**
   * Confirme une nouvelle session valide.
   *
   * Appelé uniquement lorsque l'identité du portail a pu être chargée, ce qui prouve que
   * Cloudflare Access a délivré une nouvelle session.
   */
  confirmValidSession(): void {
    this.reconnectRequired.set(false);
    this.pendingInMemory = false;
    try {
      sessionStorage.removeItem(this.reauthKey);
    }
    catch {
      // Stockage indisponible : le verrou mémoire suffit pour ce chargement de page.
    }
  }

  /**
   * Relance le parcours Cloudflare Access à la demande de l'utilisateur.
   *
   * Le bouton ne recharge plus la page. `reconnectRequired` n'est levé qu'après un
   * rechargement déjà tenté et resté sans effet : le refaire refait exactement ce qui vient
   * d'échouer. Rien ne bouge à l'écran, et comme le bandeau disparaît le temps de la
   * navigation pour revenir au `401` suivant, le bouton paraît ne rien faire.
   *
   * La session est donc terminée à la source. Cloudflare retire son cookie, ce qui rend le
   * parcours d'authentification obligatoire au retour — c'est la seule action dont l'effet ne
   * dépende pas de l'état dont on cherche justement à sortir. Le verrou est relâché avant de
   * partir, pour que la prochaine expiration retrouve son rechargement automatique.
   */
  retryNow(): void {
    this.confirmValidSession();
    window.location.assign(CLOUDFLARE_ACCESS_LOGOUT_URL);
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
