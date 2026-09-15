import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminApiService } from '../../admin-api.service';
import { AdminHomePage } from './admin-home-page';

const SETTINGS = { timezone: 'Europe/Paris' };
const SAVED = {
  id: 'home-1', title: 'Nouvelle route', contentMarkdown: 'Départ', importance: 'WARNING', status: 'DRAFT',
  active: false, countdownEnabled: false, endsAt: null, expiredMessage: null, lastModifiedBy: null,
  createdAt: '2026-09-14T10:00:00Z', updatedAt: '2026-09-14T10:00:00Z',
};

describe('AdminHomePage', () => {
  it('charge la page et envoie le payload normalisé', async () => {
    const createHomeMessage = vi.fn(() => of(SAVED));
    await TestBed.configureTestingModule({ imports: [AdminHomePage], providers: [{ provide: AdminApiService, useValue: {
      listHomeMessages: () => of([]), getSiteSettings: () => of(SETTINGS), createHomeMessage,
      updateHomeMessage: vi.fn(), activateHomeMessage: vi.fn(), deleteHomeMessage: vi.fn(),
    } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminHomePage);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: { setValue(value: Record<string, unknown>): void }; save(): void;
    };
    component.form.setValue({ title: '  Nouvelle route ', contentMarkdown: ' Départ ', importance: 'WARNING', status: 'DRAFT', countdownEnabled: false, endsAt: null, expiredMessage: ' ' });
    component.save();
    expect(createHomeMessage).toHaveBeenCalledWith({ title: 'Nouvelle route', contentMarkdown: 'Départ', importance: 'WARNING', status: 'DRAFT', countdownEnabled: false, endsAt: null, expiredMessage: null });
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain("Parchemins d'accueil");
  });

  it('affiche une erreur de chargement sans faux état vide', async () => {
    await TestBed.configureTestingModule({ imports: [AdminHomePage], providers: [{ provide: AdminApiService, useValue: {
      listHomeMessages: () => throwError(() => new Error('failure')), getSiteSettings: () => of(SETTINGS),
    } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminHomePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });
});
