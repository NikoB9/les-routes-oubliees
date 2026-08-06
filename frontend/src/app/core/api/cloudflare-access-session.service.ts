import { Injectable, signal } from '@angular/core';

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
    try {
      sessionStorage.removeItem(this.reauthKey);
    }
    catch {
      // Stockage indisponible : la protection anti-boucle reste assurée par le signal.
    }
  }

  /** Relance explicitement le parcours Cloudflare Access à la demande de l'utilisateur. */
  retryNow(): void {
    this.confirmValidSession();
    this.markPending();
    window.location.assign(window.location.href);
  }

  private isPending(): boolean {
    if (this.reconnectRequired()) {
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
    try {
      sessionStorage.setItem(this.reauthKey, 'pending');
    }
    catch {
      // Stockage indisponible : un rechargement au plus reste tenté par chargement de page.
    }
  }
}
