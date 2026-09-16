import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminApiService } from '../../admin-api.service';
import { AdminCompanyPage } from './admin-company-page';

const COMPANY = { id: 'company-1', name: 'Les Veilleurs', emblemPath: null, imageAlt: null, shortDescription: 'Braves', longDescriptionMarkdown: 'En route', active: true, createdAt: null, updatedAt: null };

describe('AdminCompanyPage', () => {
  it('normalise le payload de mise à jour', async () => {
    const updateCompany = vi.fn(() => of(COMPANY));
    await TestBed.configureTestingModule({ imports: [AdminCompanyPage], providers: [{ provide: AdminApiService, useValue: { getCompany: () => of(COMPANY), updateCompany } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminCompanyPage);
    const component = fixture.componentInstance as unknown as { form: { setValue(value: Record<string, unknown>): void }; save(): void };
    component.form.setValue({ name: ' Les Veilleurs ', emblemPath: ' ', imageAlt: '  Blason ', shortDescription: ' Braves ', longDescriptionMarkdown: ' En route ' });
    component.save();
    expect(updateCompany).toHaveBeenCalledWith({ name: 'Les Veilleurs', emblemPath: null, imageAlt: 'Blason', shortDescription: 'Braves', longDescriptionMarkdown: 'En route' });
  });

  it('présente une erreur lorsque le chargement échoue', async () => {
    await TestBed.configureTestingModule({ imports: [AdminCompanyPage], providers: [{ provide: AdminApiService, useValue: { getCompany: () => throwError(() => new Error('failure')) } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminCompanyPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
