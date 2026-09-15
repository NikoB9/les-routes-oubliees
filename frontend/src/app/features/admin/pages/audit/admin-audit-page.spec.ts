import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminAuditLog } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminAuditPage } from './admin-audit-page';

const LOG: AdminAuditLog = {
  id: 'audit-1',
  actorEmail: 'admin@example.test',
  action: 'QUEST_UPDATED',
  entityType: 'QUEST',
  entityId: 'quest-1',
  summary: 'Quête mise à jour',
  createdAt: '2026-09-14T10:00:00Z',
};

describe('AdminAuditPage', () => {
  it('renders audit entries', () => {
    TestBed.configureTestingModule({
      imports: [AdminAuditPage],
      providers: [{ provide: AdminApiService, useValue: { listAuditLogs: () => of([LOG]) } }],
    });

    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain("Journal d'audit");
    expect(fixture.nativeElement.querySelector('time')?.getAttribute('datetime')).toBe(LOG.createdAt);
    expect(fixture.nativeElement.textContent).toContain('Quête mise à jour');
  });

  it('renders the empty state only after a successful load', () => {
    TestBed.configureTestingModule({
      imports: [AdminAuditPage],
      providers: [{ provide: AdminApiService, useValue: { listAuditLogs: () => of([]) } }],
    });

    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('Aucune action auditée');
  });

  it('shows an alert without an empty state when loading fails', () => {
    TestBed.configureTestingModule({
      imports: [AdminAuditPage],
      providers: [
        {
          provide: AdminApiService,
          useValue: { listAuditLogs: () => throwError(() => new Error('failure')) },
        },
      ],
    });

    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });
});
