import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AdminAllowedEmail } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminAdministratorsPage } from './administrators-page';

const ADMINISTRATOR: AdminAllowedEmail = {
  id: 'admin-1',
  email: 'admin@example.test',
  label: 'Organisation',
  active: true,
  createdAt: '2026-09-14T10:00:00Z',
  updatedAt: '2026-09-14T10:00:00Z',
};

interface AdministratorsHarness {
  toggleAllowedEmail(item: AdminAllowedEmail): void;
}

describe('AdminAdministratorsPage', () => {
  let updateResponse: () => Observable<AdminAllowedEmail>;

  beforeEach(async () => {
    updateResponse = () => of({ ...ADMINISTRATOR, active: false });
    await TestBed.configureTestingModule({
      imports: [AdminAdministratorsPage],
      providers: [
        {
          provide: AdminApiService,
          useValue: {
            listAllowedEmails: () => of([ADMINISTRATOR]),
            createAllowedEmail: () => of(ADMINISTRATOR),
            updateAllowedEmail: () => updateResponse(),
            deleteAllowedEmail: () => of(undefined),
          },
        },
      ],
    }).compileComponents();
  });

  it('nomme chaque action avec l’adresse concernée', () => {
    const fixture = TestBed.createComponent(AdminAdministratorsPage);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const labels = Array.from(buttons).map((button) => button.textContent?.trim());

    expect(labels).toContain('Désactiver admin@example.test');
    expect(labels).toContain('Supprimer admin@example.test');
  });

  it('relaie le détail 409 expliquant l’invariant du dernier administrateur actif', () => {
    updateResponse = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'Le dernier administrateur actif ne peut pas être désactivé.' },
          }),
      );
    const fixture = TestBed.createComponent(AdminAdministratorsPage);
    const component = fixture.componentInstance as unknown as AdministratorsHarness;

    component.toggleAllowedEmail(ADMINISTRATOR);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Le dernier administrateur actif ne peut pas être désactivé.',
    );
  });

  it('ne révèle jamais le détail technique d’une erreur serveur', () => {
    updateResponse = () =>
      throwError(
        () => new HttpErrorResponse({ status: 500, error: { detail: 'secret-database-error' } }),
      );
    const fixture = TestBed.createComponent(AdminAdministratorsPage);
    const component = fixture.componentInstance as unknown as AdministratorsHarness;

    component.toggleAllowedEmail(ADMINISTRATOR);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('secret-database-error');
    expect(fixture.nativeElement.textContent).toContain('Impossible de traiter');
  });
});
