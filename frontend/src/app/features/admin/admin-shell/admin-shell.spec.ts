import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { NotebookApiService } from '../../notebook/notebook-api.service';
import { AdminApiService } from '../admin-api.service';
import { MediaApiService } from '../media-api.service';
import { AdminShell } from './admin-shell';

interface DateConversionHarness {
  toOffsetDateTime(value: string | null, timezone: string): string | null;
  toLocalDateTimeInput(value: string | null, timezone: string): string | null;
}

describe('AdminShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ section: 'home' })),
          },
        },
        {
          provide: AdminAuthService,
          useValue: {
            currentSession: () => of({ authenticated: true, email: 'admin@example.test' }),
            logout: () => of(void 0),
          },
        },
        {
          provide: AdminApiService,
          useValue: {
            listHomeMessages: () => of([]),
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
          useValue: {},
        },
        {
          provide: MediaApiService,
          useValue: {},
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
});
