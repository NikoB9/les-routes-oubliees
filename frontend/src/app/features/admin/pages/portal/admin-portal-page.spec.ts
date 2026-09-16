import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AdminAdventurer, AdminPortalIdentity } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminPortalPage } from './admin-portal-page';

const ASSIGNED_ID = 'adventurer-visible';
const HIDDEN_ASSIGNED_ID = 'adventurer-hidden-assigned';

const IDENTITIES: AdminPortalIdentity[] = [
  {
    id: 'identity-assigned',
    normalizedEmail: 'joueuse@example.test',
    cloudflareSubject: 'subject-1',
    accessMode: 'ADVENTURER',
    adventurerId: ASSIGNED_ID,
    adventurerName: 'Maelis',
    selectedAt: '2026-09-14T10:00:00Z',
    createdAt: '2026-09-14T10:00:00Z',
    updatedAt: '2026-09-14T10:00:00Z',
  },
  {
    id: 'identity-guest',
    normalizedEmail: 'invite@example.test',
    cloudflareSubject: 'subject-2',
    accessMode: 'GUEST',
    adventurerId: null,
    adventurerName: null,
    selectedAt: null,
    createdAt: '2026-09-14T10:00:00Z',
    updatedAt: '2026-09-14T10:00:00Z',
  },
  {
    id: 'identity-hidden',
    normalizedEmail: 'masquee@example.test',
    cloudflareSubject: 'subject-3',
    accessMode: 'ADVENTURER',
    adventurerId: HIDDEN_ASSIGNED_ID,
    adventurerName: 'Sorne',
    selectedAt: '2026-09-14T10:00:00Z',
    createdAt: '2026-09-14T10:00:00Z',
    updatedAt: '2026-09-14T10:00:00Z',
  },
];

const ADVENTURERS = [
  { id: ASSIGNED_ID, name: 'Maelis', visible: true, displayOrder: 1 },
  { id: 'adventurer-hidden', name: 'Ombre', visible: false, displayOrder: 2 },
  { id: HIDDEN_ASSIGNED_ID, name: 'Sorne', visible: false, displayOrder: 3 },
] as AdminAdventurer[];

function portalSelects(compiled: HTMLElement, index: number) {
  const row = compiled.querySelectorAll('.admin-list > li')[index];
  return {
    mode: row?.querySelector<HTMLSelectElement>('select[name="portalMode"]') ?? null,
    adventurer: row?.querySelector<HTMLSelectElement>('select[name="portalAdventurer"]') ?? null,
  };
}

function selectOption(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('AdminPortalPage', () => {
  let updateResponse: () => Observable<AdminPortalIdentity>;
  let adventurersResponse: () => Observable<AdminAdventurer[]>;
  let payloads: unknown[];

  beforeEach(() => {
    updateResponse = () => of(IDENTITIES[0]);
    adventurersResponse = () => of(ADVENTURERS);
    payloads = [];
    TestBed.configureTestingModule({
      imports: [AdminPortalPage],
      providers: [
        {
          provide: AdminApiService,
          useValue: {
            listPortalIdentities: () => of(IDENTITIES),
            listAdventurers: () => adventurersResponse(),
            updatePortalAssignment: (_id: string, payload: unknown) => {
              payloads.push(payload);
              return updateResponse();
            },
          },
        },
      ],
    });
  });

  it('preselects reactive controls from the current assignments', () => {
    const fixture = TestBed.createComponent(AdminPortalPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Identités du portail');
    expect(portalSelects(compiled, 0).mode?.value).toBe('ADVENTURER');
    expect(portalSelects(compiled, 0).adventurer?.value).toBe(ASSIGNED_ID);
    expect(portalSelects(compiled, 1).mode?.value).toBe('GUEST');
  });

  it('only offers visible adventurers plus the hidden current assignment', () => {
    const fixture = TestBed.createComponent(AdminPortalPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const offered = (index: number) =>
      Array.from(portalSelects(compiled, index).adventurer?.options ?? []).map((option) => option.value);

    expect(offered(0)).toEqual(['', ASSIGNED_ID]);
    expect(offered(2)).toEqual(['', ASSIGNED_ID, HIDDEN_ASSIGNED_ID]);
    expect(compiled.textContent).toContain('Sorne (masqué)');
  });

  it('uses the unassigned mode when an adventurer is removed', () => {
    const fixture = TestBed.createComponent(AdminPortalPage);
    fixture.detectChanges();
    selectOption(portalSelects(fixture.nativeElement, 0).adventurer!, '');

    expect(payloads).toEqual([{ accessMode: 'UNASSIGNED', adventurerId: null }]);
  });

  it('replaces success with a specific message after a conflict', () => {
    const fixture = TestBed.createComponent(AdminPortalPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    selectOption(portalSelects(compiled, 1).adventurer!, ASSIGNED_ID);
    fixture.detectChanges();
    expect(compiled.querySelector('.status')).not.toBeNull();

    updateResponse = () => throwError(() => new HttpErrorResponse({ status: 409 }));
    selectOption(portalSelects(compiled, 1).mode!, 'UNASSIGNED');
    fixture.detectChanges();
    expect(compiled.querySelector('.status')).toBeNull();
    expect(compiled.querySelector('.alert')?.textContent).toContain('déjà attribué');
  });

  it('préserve et désactive l’attribution actuelle si les aventuriers sont indisponibles', () => {
    adventurersResponse = () => throwError(() => new Error('failure'));
    const fixture = TestBed.createComponent(AdminPortalPage);
    fixture.detectChanges();
    const select = portalSelects(fixture.nativeElement, 0).adventurer;

    expect(select?.disabled).toBe(true);
    expect(select?.value).toBe(ASSIGNED_ID);
    expect(fixture.nativeElement.textContent).toContain('les autres modes restent modifiables');
  });
});
