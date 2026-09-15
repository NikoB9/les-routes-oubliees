import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminAuditLog } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-audit-page',
  imports: [LoadingIndicatorComponent],
  templateUrl: './admin-audit-page.html',
  styleUrl: './admin-audit-page.css',
})
export class AdminAuditPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly auditLogs = signal<AdminAuditLog[]>([]);
  protected readonly loadState = signal<LoadState>('loading');

  constructor() {
    this.adminApi.listAuditLogs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (auditLogs) => {
        this.auditLogs.set(auditLogs);
        this.loadState.set('ready');
      },
      error: () => this.loadState.set('error'),
    });
  }
}
