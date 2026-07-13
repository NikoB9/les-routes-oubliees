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
import { LoadingIndicatorComponent } from './shared/components/loading-indicator/loading-indicator';

@Component({
  selector: 'app-root',
  imports: [
    DesktopNavigationComponent,
    LoadingIndicatorComponent,
    MobileNavigationComponent,
    PublicHeaderComponent,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly isNavigating = signal(false);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  constructor() {
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
          queueMicrotask(() => this.document.getElementById('main-content')?.focus());
        }
      }
    });
  }
}
