import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminApiService } from '../../admin-api.service';
import { AdminSettingsPage } from './admin-settings-page';

const SETTINGS = { id: 'settings-1', siteName: 'Les Routes Oubliées', subtitle: null, logoPath: null, timezone: 'Europe/Paris', status: 'ONLINE', maintenanceMessage: null, accessibilityInformationMarkdown: 'Accessible', updatedBy: null, createdAt: '2026-09-14T10:00:00Z', updatedAt: '2026-09-14T10:00:00Z' };

describe('AdminSettingsPage', () => {
  it('normalise le payload et retire le message hors maintenance', async () => {
    const updateSiteSettings = vi.fn(() => of(SETTINGS));
    await TestBed.configureTestingModule({ imports: [AdminSettingsPage], providers: [{ provide: AdminApiService, useValue: { getSiteSettings: () => of(SETTINGS), updateSiteSettings } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminSettingsPage);
    const component = fixture.componentInstance as unknown as { form: { setValue(value: Record<string, unknown>): void }; save(): void };
    component.form.setValue({ siteName: ' Routes ', subtitle: ' Sous-titre ', logoPath: ' ', timezone: ' Europe/Paris ', status: 'ONLINE', maintenanceMessage: 'Ignoré', accessibilityInformationMarkdown: ' Accessible ' });
    component.save();
    expect(updateSiteSettings).toHaveBeenCalledWith({ siteName: 'Routes', subtitle: 'Sous-titre', logoPath: null, timezone: 'Europe/Paris', status: 'ONLINE', maintenanceMessage: null, accessibilityInformationMarkdown: 'Accessible' });
  });

  it('présente une erreur lorsque le chargement échoue', async () => {
    await TestBed.configureTestingModule({ imports: [AdminSettingsPage], providers: [{ provide: AdminApiService, useValue: { getSiteSettings: () => throwError(() => new Error('failure')) } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminSettingsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
