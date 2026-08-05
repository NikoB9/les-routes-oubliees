import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator';
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

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
      }
    });
  }
}
