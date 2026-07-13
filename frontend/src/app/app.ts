import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';

import { DesktopNavigationComponent } from './layout/desktop-navigation/desktop-navigation';
import { PublicHeaderComponent } from './layout/header/public-header';
import { MobileNavigationComponent } from './layout/mobile-navigation/mobile-navigation';
import { PublicContentCacheService } from './core/offline/public-content-cache.service';
import { PwaInstallPromptService } from './core/pwa/pwa-install-prompt.service';
import { LoadingIndicatorComponent } from './shared/components/loading-indicator/loading-indicator';
import { PwaInstallPromptComponent } from './shared/components/pwa-install-prompt/pwa-install-prompt';

@Component({
  selector: 'app-root',
  imports: [
    DesktopNavigationComponent,
    LoadingIndicatorComponent,
    MobileNavigationComponent,
    PublicHeaderComponent,
    PwaInstallPromptComponent,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly isNavigating = signal(false);
  protected readonly pwaPrompt = inject(PwaInstallPromptService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly publicContentCache = inject(PublicContentCacheService);
  private readonly onlineListener = () => this.refreshPublicCache();
  private readonly visibilityListener = () => {
    if (this.document.visibilityState === 'visible') {
      this.refreshPublicCache();
    }
  };

  constructor() {
    this.refreshPublicCache();

    window.addEventListener('online', this.onlineListener);
    this.document.addEventListener('visibilitychange', this.visibilityListener);
    this.destroyRef.onDestroy(() => window.removeEventListener('online', this.onlineListener));
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('visibilitychange', this.visibilityListener),
    );

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isNavigating.set(true);
        return;
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isNavigating.set(false);
        if (event instanceof NavigationEnd) {
          this.refreshPublicCache();
          queueMicrotask(() => this.document.getElementById('main-content')?.focus());
        }
      }
    });
  }

  private refreshPublicCache(): void {
    void this.publicContentCache.refreshIfNeeded().catch(() => {
      // The cache is opportunistic: public pages keep their normal error or fallback states.
    });
  }
}
