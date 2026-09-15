import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AdminDashboard } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminDashboardPage } from './admin-dashboard-page';

const DASHBOARD: AdminDashboard = {
  activeHomeMessageTitle: 'Le départ',
  activeMapVisionName: 'Val d’Aurelune',
  activeCompanyName: 'Les Veilleurs',
  visibleAdventurerCount: 4,
  visibleQuestCount: 2,
  mediaCount: 7,
  activeAdministratorCount: 1,
  latestAuditLogs: [],
};

describe('AdminDashboardPage', () => {
  it('distinguishes loading from loaded content', () => {
    const response = new Subject<AdminDashboard>();
    TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [{ provide: AdminApiService, useValue: { getDashboard: () => response } }],
    });

    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chargement de la synthèse');

    response.next(DASHBOARD);
    response.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Le départ');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Tableau de bord');
  });

  it('shows an alert when loading fails', () => {
    TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [
        { provide: AdminApiService, useValue: { getDashboard: () => throwError(() => new Error('failure')) } },
      ],
    });

    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Impossible');
  });

  it('renders the dashboard summary returned by the API', () => {
    TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [{ provide: AdminApiService, useValue: { getDashboard: () => of(DASHBOARD) } }],
    });

    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dashboard-grid > div')).toHaveLength(7);
  });
});
