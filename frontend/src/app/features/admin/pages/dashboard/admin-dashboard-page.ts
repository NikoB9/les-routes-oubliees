import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminDashboard } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [LoadingIndicatorComponent],
  templateUrl: './admin-dashboard-page.html',
  styleUrl: './admin-dashboard-page.css',
})
export class AdminDashboardPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly loadState = signal<LoadState>('loading');

  constructor() {
    this.adminApi.getDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.loadState.set('ready');
      },
      error: () => this.loadState.set('error'),
    });
  }
}
