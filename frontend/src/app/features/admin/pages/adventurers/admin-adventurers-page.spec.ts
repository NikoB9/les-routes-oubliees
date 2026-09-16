import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminApiService } from '../../admin-api.service';
import { AdminAdventurersPage } from './admin-adventurers-page';

const SAVED = { id: 'adventurer-1', name: 'Maelis', title: 'Éclaireuse', avatarPath: null, avatarAlt: null, shortDescription: 'Rapide', strengths: 'Vue', weaknesses: 'Froid', visible: true, displayOrder: 1, createdAt: '2026-09-14T10:00:00Z', updatedAt: '2026-09-14T10:00:00Z' };

describe('AdminAdventurersPage', () => {
  it('crée un aventurier avec un payload normalisé', async () => {
    const createAdventurer = vi.fn(() => of(SAVED));
    await TestBed.configureTestingModule({ imports: [AdminAdventurersPage], providers: [{ provide: AdminApiService, useValue: {
      listAdventurers: () => of([]), createAdventurer, updateAdventurer: vi.fn(), reorderAdventurers: vi.fn(), deleteAdventurer: vi.fn(),
    } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminAdventurersPage);
    const component = fixture.componentInstance as unknown as { form: { setValue(value: Record<string, unknown>): void }; save(): void };
    component.form.setValue({ name: ' Maelis ', title: ' Éclaireuse ', avatarPath: ' ', avatarAlt: null, shortDescription: ' Rapide ', strengths: ' Vue ', weaknesses: ' Froid ', visible: true, displayOrder: 1 });
    component.save();
    expect(createAdventurer).toHaveBeenCalledWith({ name: 'Maelis', title: 'Éclaireuse', avatarPath: null, avatarAlt: null, shortDescription: 'Rapide', strengths: 'Vue', weaknesses: 'Froid', visible: true, displayOrder: 1 });
  });

  it('ne présente pas un état vide en cas d’échec de chargement', async () => {
    await TestBed.configureTestingModule({ imports: [AdminAdventurersPage], providers: [{ provide: AdminApiService, useValue: { listAdventurers: () => throwError(() => new Error('failure')) } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminAdventurersPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });
});
