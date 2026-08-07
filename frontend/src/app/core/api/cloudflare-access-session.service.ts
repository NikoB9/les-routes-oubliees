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
   * Vrai entre le clic sur la reconnexion et le départ effectif de la page.
   *
   * La sortie de session est un aller-retour réseau : sans état visible, le bandeau resterait
   * identique pendant ce temps et le bouton paraîtrait de nouveau inerte — le défaut même que
   * la reconnexion vient corriger.
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
    this.reconnecting.set(false);
    this.releaseLock();
  }

  /**
   * Relance le parcours Cloudflare Access à la demande de l'utilisateur.
   *
   * Le bouton ne recharge plus la page. `reconnectRequired` n'est levé qu'après un
   * rechargement déjà tenté et resté sans effet : le refaire refait exactement ce qui vient
   * d'échouer. Rien ne bouge à l'écran, et comme le bandeau disparaît le temps de la
   * navigation pour revenir au `401` suivant, le bouton paraît ne rien faire.
   *
   * La session est donc terminée à la source, puis l'utilisateur est ramené où il était.
   */
  retryNow(): void {
    if (this.reconnecting()) {
      return;
    }
    this.reconnecting.set(true);
    void this.leaveAccessSession();
  }

  /**
   * Sort de la session Access sans faire quitter sa page à l'utilisateur.
   *
   * La déconnexion est demandée en arrière-plan plutôt que par une navigation : Cloudflare
   * retire son cookie dans la réponse, et la navigation qui suit repart alors sans session,
   * ce qui rend le parcours d'authentification obligatoire. C'est la seule action dont
   * l'effet ne dépende pas de l'état dont on cherche justement à sortir. L'utilisateur
   * revient ensuite sur l'adresse qu'il consultait, pas sur la page de déconnexion.
   *
   * Cloudflare ne documente aucun paramètre de retour sur `/cdn-cgi/access/logout` — ni
   * `returnTo` ni équivalent, ni sur la page « Session management » ni dans la FAQ Identity.
   * Faire le trajet en deux temps depuis l'application ne dépend d'aucun comportement non
   * documenté.
   *
   * L'attente de la réponse n'est pas facultative : partir avant que l'en-tête `Set-Cookie`
   * ne soit traité emporterait l'ancienne session, et Cloudflare laisserait passer sans rien
   * redemander.
   *
   * `redirect: 'manual'` est ce qui rend l'appel viable. La déconnexion répond couramment par
   * une redirection vers `<équipe>.cloudflareaccess.com`, une autre origine : suivie, elle
   * serait refusée par `connect-src 'self'`, la requête échouerait et le repli s'appliquerait
   * à chaque fois. Ne pas la suivre laisse le navigateur traiter le `Set-Cookie` de la
   * réponse — c'est tout ce dont on a besoin — et rend une redirection opaque, sans corps ni
   * statut lisible. Elle vaut donc succès au même titre qu'un `200`.
   *
   * L'échec renvoie à la page de déconnexion visible. Elle fait moins bien — l'utilisateur
   * doit revenir seul — mais elle aboutit, là où rester sur place ne laisserait aucune issue.
   */
  private async leaveAccessSession(): Promise<void> {
    const destination = window.location.href;
    // Le verrou est relâché avant de partir, pour que la prochaine expiration retrouve son
    // rechargement automatique. Le bandeau, lui, reste affiché jusqu'à la navigation.
    this.releaseLock();
    try {
      const response = await fetch(CLOUDFLARE_ACCESS_LOGOUT_URL, {
        credentials: 'include',
        cache: 'no-store',
        redirect: 'manual',
      });
      if (!response.ok && response.type !== 'opaqueredirect') {
        throw new Error(`logout ${response.status}`);
      }
    }
    catch {
      window.location.assign(CLOUDFLARE_ACCESS_LOGOUT_URL);
      return;
    }
    window.location.assign(destination);
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
