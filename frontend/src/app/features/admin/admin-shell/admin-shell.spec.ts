import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { defer, of } from 'rxjs';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { NotebookApiService } from '../../notebook/notebook-api.service';
import { AdminApiService } from '../admin-api.service';
import { MediaApiService } from '../media-api.service';
import { AdminShell } from './admin-shell';

interface DateConversionHarness {
  toOffsetDateTime(value: string | null, timezone: string): string | null;
  toLocalDateTimeInput(value: string | null, timezone: string): string | null;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('AdminShell', () => {
  let sectionParam = 'home';

  beforeEach(async () => {
    sectionParam = 'home';
    globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;

    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: defer(() => of(convertToParamMap({ section: sectionParam }))),
          },
        },
        {
          provide: AdminAuthService,
          useValue: {
            currentSession: () => of({ authenticated: true, email: 'admin@example.test' }),
          },
        },
        {
          provide: AdminApiService,
          useValue: {
            listHomeMessages: () => of([]),
            listMapVisions: () =>
              of([
                {
                  id: '40000000-0000-0000-0000-000000000001',
                  name: 'Carte voilee',
                  descriptionMarkdown: 'Description',
                  assetPath: '/assets/maps/map-hidden.png',
                  imageAlt: 'Carte voilee.',
                  displayOrder: 1,
                  status: 'PUBLISHED',
                  active: true,
                  createdAt: '2026-07-13T10:00:00Z',
                  updatedAt: '2026-07-13T10:00:00Z',
                },
              ]),
            listMapMarkers: () =>
              of([
                {
                  id: '60000000-0000-0000-0000-000000000001',
                  questCode: 'QUEST_1',
                  title: 'Premier appel',
                  positionX: 31.5,
                  positionY: 70,
                  labelPosition: 'BOTTOM',
                  labelOffsetPx: 22,
                  active: true,
                  displayOrder: 1,
                  createdAt: '2026-07-13T10:00:00Z',
                  updatedAt: '2026-07-13T10:00:00Z',
                },
              ]),
            getSiteSettings: () =>
              of({
                id: '60000000-0000-0000-0000-000000000001',
                siteName: 'Les Routes Oubliées',
                subtitle: null,
                logoPath: null,
                timezone: 'Europe/Paris',
                status: 'ONLINE',
                maintenanceMessage: null,
                accessibilityInformationMarkdown: 'Informations.',
                updatedBy: null,
                createdAt: '2026-07-13T10:00:00Z',
                updatedAt: '2026-07-13T10:00:00Z',
              }),
          },
        },
        {
          provide: NotebookApiService,
          useValue: {
            listAdminQuests: () =>
              of([
                {
                  id: '50000000-0000-0000-0000-000000000001',
                  code: 'QUEST_1',
                  title: 'Quete 1',
                  summary: 'Resume public',
                  importantEventsMarkdown: '',
                  importantEventsHtml: '',
                  discoveredCluesMarkdown: '',
                  discoveredCluesHtml: '',
                  completedTrialsMarkdown: '',
                  completedTrialsHtml: '',
                  extraContentMarkdown: '',
                  extraContentHtml: '',
                  adminDraftMarkdown: '',
                  adminDraftHtml: '',
                  status: 'DRAFT',
                  visibleToPlayers: false,
                  displayOrder: 1,
                  createdAt: '2026-07-13T10:00:00Z',
                  updatedAt: '2026-07-13T10:00:00Z',
                },
              ]),
          },
        },
        {
          provide: MediaApiService,
          useValue: {
            listAdminMedia: () => of([]),
          },
        },
      ],
    }).compileComponents();
  });

  it('converts countdown dates between Europe Paris local input and offset ISO values', () => {
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as DateConversionHarness;

    expect(shell.toOffsetDateTime('2026-07-12T20:00', 'Europe/Paris')).toBe(
      '2026-07-12T20:00:00+02:00',
    );
    expect(shell.toOffsetDateTime('2026-12-12T20:00', 'Europe/Paris')).toBe(
      '2026-12-12T20:00:00+01:00',
    );
    expect(shell.toLocalDateTimeInput('2026-07-12T18:00:00Z', 'Europe/Paris')).toBe(
      '2026-07-12T20:00',
    );
  });

  it('shows Markdown tools on quest Markdown fields but not on the public summary', () => {
    sectionParam = 'notebook';
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summary = compiled.querySelector('textarea[name="summary"]');
    const summaryLabel = summary?.closest('label');

    expect(compiled.querySelectorAll('app-markdown-toolbar').length).toBeGreaterThanOrEqual(5);
    expect(summaryLabel?.textContent).toContain('Résumé public');
    expect(summaryLabel?.querySelector('app-markdown-toolbar')).toBeNull();
  });

  it('shows map marker label position controls', async () => {
    sectionParam = 'map';
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const positionSelect = compiled.querySelector<HTMLSelectElement>(
      'select[name="mapMarkerLabelPosition"]',
    );
    const offsetInput = compiled.querySelector<HTMLInputElement>('input[name="mapMarkerLabelOffset"]');

    expect(positionSelect?.value).toBe('BOTTOM');
    expect(Array.from(positionSelect?.options ?? []).map((option) => option.value)).toEqual([
      'TOP',
      'BOTTOM',
      'LEFT',
      'RIGHT',
    ]);
    expect(offsetInput?.value).toBe('22');
  });
});
