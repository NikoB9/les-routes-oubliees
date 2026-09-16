import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { filter, merge, take, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const APPLICATION_RELOAD = new InjectionToken<() => void>('APPLICATION_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.defaultView?.location.reload();
  },
});

@Injectable({ providedIn: 'root' })
export class ApplicationUpdateService {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly updates = inject(SwUpdate);
  private readonly reloadApplication = inject(APPLICATION_RELOAD);
  private readonly updateReady = signal(false);
  private readonly recoveryRequired = signal(false);
  private updateCheck: Promise<void> | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private started = false;

  readonly isAvailable = this.updateReady.asReadonly();
  readonly isRecoveryRequired = this.recoveryRequired.asReadonly();

  private readonly onlineListener = () => this.checkForUpdate();
  private readonly visibilityListener = () => {
    if (this.document.visibilityState === 'visible') {
      this.checkForUpdate();
    }
  };

  constructor() {
    if (!this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleVersionEvent(event));
    this.updates.unrecoverable.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.recoveryRequired.set(true);
      this.updateReady.set(true);
    });

    const view = this.document.defaultView;
    view?.addEventListener('online', this.onlineListener);
    this.document.addEventListener('visibilitychange', this.visibilityListener);

    this.destroyRef.onDestroy(() => {
      view?.removeEventListener('online', this.onlineListener);
      this.document.removeEventListener('visibilitychange', this.visibilityListener);
      if (this.intervalId !== null) {
        clearInterval(this.intervalId);
      }
    });

    merge(
      this.applicationRef.isStable.pipe(filter((stable) => stable)),
      timer(30_000),
    )
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.startChecks());
  }

  reload(): void {
    this.reloadApplication();
  }

  private startChecks(): void {
    this.started = true;
    this.checkForUpdate();
    this.intervalId = setInterval(() => this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
  }

  private checkForUpdate(): void {
    if (!this.started || this.updateCheck !== null) {
      return;
    }

    try {
      this.updateCheck = this.updates
        .checkForUpdate()
        .then(() => undefined)
        .catch((error: unknown) => {
          console.warn('La vérification de mise à jour a échoué.', error);
        })
        .finally(() => {
          this.updateCheck = null;
        });
    } catch (error: unknown) {
      // Une absence temporaire de réseau ne doit jamais empêcher l'application de démarrer.
      console.warn('La vérification de mise à jour a échoué.', error);
    }
  }

  private handleVersionEvent(event: VersionEvent): void {
    if (event.type === 'VERSION_READY') {
      this.updateReady.set(true);
      return;
    }
    if (event.type === 'VERSION_INSTALLATION_FAILED') {
      console.error("L'installation de la nouvelle version a échoué.", event.error);
    }
  }
}
