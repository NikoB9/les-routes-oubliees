import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator';
import { PortalAdventurerChoice } from './portal.models';
import { PortalIdentityStore } from './portal-identity.store';

@Component({
  selector: 'app-portal-identity-dialog',
  imports: [LoadingIndicatorComponent],
  templateUrl: './portal-identity-dialog.html',
  styleUrl: './portal-identity-dialog.css',
})
export class PortalIdentityDialogComponent {
  protected readonly portal = inject(PortalIdentityStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly identityDialog = viewChild<ElementRef<HTMLDialogElement>>('identityDialog');
  private readonly confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');

  protected readonly currentUrl = signal(this.router.url);
  protected readonly suppressed = computed(() => this.currentUrl().startsWith('/admin'));
  protected readonly visible = computed(
    () =>
      !this.suppressed() &&
      this.portal.loaded() &&
      !this.portal.loading() &&
      !this.portal.error() &&
      this.portal.needsAssignment(),
  );

  /** Élément à qui restituer le focus à la fermeture du dialogue de confirmation. */
  private confirmationTrigger: HTMLElement | null = null;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
      }
    });

    effect(() => this.synchronize(this.identityDialog()?.nativeElement, this.visible()));
    effect(() => {
      const confirming = this.portal.confirmingAdventurer() !== null;
      this.synchronize(this.confirmDialog()?.nativeElement, confirming && !this.suppressed());
      if (!confirming) {
        this.restoreConfirmationFocus();
      }
    });
  }

  protected askAssignment(adventurer: PortalAdventurerChoice, event: Event): void {
    this.confirmationTrigger = event.currentTarget as HTMLElement | null;
    this.portal.askAssignment(adventurer);
  }

  protected cancelAssignment(event?: Event): void {
    event?.preventDefault();
    this.portal.cancelAssignment();
  }

  /**
   * Le choix du reflet est obligatoire : la fermeture par `Échap` est refusée, et aucun
   * bouton de fermeture n'est proposé. Cette dérogation est documentée dans
   * `docs/ACCESSIBILITE.md`.
   */
  protected blockDismissal(event: Event): void {
    event.preventDefault();
  }

  private synchronize(dialog: HTMLDialogElement | undefined, shouldBeOpen: boolean): void {
    if (!dialog) {
      return;
    }
    const open = dialog.hasAttribute('open');
    if (shouldBeOpen && !open) {
      // showModal() rend l'arrière-plan inerte et confine le focus dans le dialogue.
      // La solution de repli couvre les environnements sans HTMLDialogElement complet.
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
      else {
        dialog.setAttribute('open', '');
      }
      this.focusInside(dialog);
      return;
    }
    if (!shouldBeOpen && open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      }
      else {
        dialog.removeAttribute('open');
      }
    }
  }

  /** Place le focus initial à l'intérieur du dialogue, quel que soit l'environnement. */
  private focusInside(dialog: HTMLDialogElement): void {
    const focusable = dialog.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    (focusable ?? dialog).focus();
  }

  private restoreConfirmationFocus(): void {
    const trigger = this.confirmationTrigger;
    this.confirmationTrigger = null;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
  }
}
