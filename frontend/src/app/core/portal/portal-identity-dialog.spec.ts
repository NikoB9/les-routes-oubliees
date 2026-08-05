import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PortalIdentityStore } from './portal-identity.store';
import { PortalMe } from './portal.models';
import { PortalIdentityDialogComponent } from './portal-identity-dialog';

describe('PortalIdentityDialogComponent', () => {
  let fixture: ComponentFixture<PortalIdentityDialogComponent>;
  let portal: WritableSignal<PortalMe | null>;

  beforeEach(async () => {
    portal = signal({
      identity: {
        id: 'identity-1',
        accessMode: 'UNASSIGNED',
        adventurerId: null,
        displayName: null,
        avatarPath: null,
        selectedAt: null,
      },
      availableAdventurers: [
        {
          id: 'adventurer-1',
          name: 'Aurelune',
          title: 'Gardienne des secrets',
          avatarPath: null,
          avatarAlt: null,
        },
      ],
      guestAvailable: false,
      canAccessAdmin: false,
    });

    await TestBed.configureTestingModule({
      imports: [PortalIdentityDialogComponent],
      providers: [
        provideRouter([
          { path: '', component: PortalIdentityDialogComponent },
          { path: 'admin', component: PortalIdentityDialogComponent },
        ]),
        {
          provide: PortalIdentityStore,
          useValue: {
            portal,
            loaded: signal(true),
            loading: signal(false),
            error: signal(false),
            needsAssignment: signal(true),
            assignmentConflict: signal(false),
            confirmingAdventurer: signal(null),
            askAssignment: vi.fn(),
            chooseGuest: vi.fn(),
            confirmAssignment: vi.fn(),
            cancelAssignment: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortalIdentityDialogComponent);
    fixture.detectChanges();
  });

  it('requires an adventurer choice globally', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="dialog"]')?.textContent).toContain('Choisir votre reflet');
    expect(compiled.querySelector('.choice-button')?.textContent).toContain('Aurelune');
    expect(compiled.querySelector('.guest-button')).toBeNull();
  });

  it('offers guest access only when no adventurer is available', () => {
    portal.update((current) => ({
      ...current!,
      availableAdventurers: [],
      guestAvailable: true,
    }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.choice-button')).toBeNull();
    expect(compiled.querySelector('.guest-button')?.textContent).toContain('Accéder comme invité');
  });

  it('does not cover admin routes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="dialog"]')).toBeNull();
  });
});
