import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PortalIdentityStore } from './portal-identity.store';
import { PortalAdventurerChoice, PortalMe } from './portal.models';
import { PortalIdentityDialogComponent } from './portal-identity-dialog';

describe('PortalIdentityDialogComponent', () => {
  let fixture: ComponentFixture<PortalIdentityDialogComponent>;
  let portal: WritableSignal<PortalMe | null>;
  let confirmingAdventurer: WritableSignal<PortalAdventurerChoice | null>;
  let askAssignment: ReturnType<typeof vi.fn>;
  let cancelAssignment: ReturnType<typeof vi.fn>;

  const aurelune: PortalAdventurerChoice = {
    id: 'adventurer-1',
    name: 'Aurelune',
    title: 'Gardienne des secrets',
    avatarPath: null,
    avatarAlt: null,
  };

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
      availableAdventurers: [aurelune],
      guestAvailable: false,
      canAccessAdmin: false,
    });
    confirmingAdventurer = signal<PortalAdventurerChoice | null>(null);
    askAssignment = vi.fn((adventurer: PortalAdventurerChoice) =>
      confirmingAdventurer.set(adventurer),
    );
    cancelAssignment = vi.fn(() => confirmingAdventurer.set(null));

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
            confirmingAdventurer,
            askAssignment,
            chooseGuest: vi.fn(),
            confirmAssignment: vi.fn(),
            cancelAssignment,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortalIdentityDialogComponent);
    fixture.detectChanges();
  });

  it('requires an adventurer choice globally', () => {
    expect(identityDialog().hasAttribute('open')).toBe(true);
    expect(identityDialog().getAttribute('aria-labelledby')).toBe('identity-title');
    expect(identityDialog().querySelector('#identity-title')?.textContent).toContain(
      'Choisir votre reflet',
    );
    expect(identityDialog().querySelector('.choice-button')?.textContent).toContain('Aurelune');
    expect(identityDialog().querySelector('.guest-button')).toBeNull();
  });

  it('places the initial focus inside the dialog', () => {
    expect(identityDialog().contains(document.activeElement)).toBe(true);
  });

  it('never exposes a positive tabindex', () => {
    const withTabindex = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[tabindex]'),
    ).map((element) => Number(element.getAttribute('tabindex')));

    expect(withTabindex.every((value) => value <= 0)).toBe(true);
  });

  it('refuses to close the mandatory dialog with Escape', () => {
    identityDialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(identityDialog().hasAttribute('open')).toBe(true);
  });

  it('offers guest access only when no adventurer is available', () => {
    portal.update((current) => ({
      ...current!,
      availableAdventurers: [],
      guestAvailable: true,
    }));
    fixture.detectChanges();

    expect(identityDialog().querySelector('.choice-button')).toBeNull();
    expect(identityDialog().querySelector('.guest-button')?.textContent).toContain(
      'Accéder comme invité',
    );
  });

  it('opens the confirmation dialog and restores the focus to its trigger', () => {
    const trigger = identityDialog().querySelector<HTMLButtonElement>('.choice-button');
    trigger?.focus();
    trigger?.click();
    fixture.detectChanges();

    expect(askAssignment).toHaveBeenCalledWith(aurelune);
    expect(confirmDialog().hasAttribute('open')).toBe(true);
    expect(confirmDialog().getAttribute('aria-labelledby')).toBe('confirm-title');
    expect(confirmDialog().contains(document.activeElement)).toBe(true);

    confirmDialog().querySelector<HTMLButtonElement>('.secondary')?.click();
    fixture.detectChanges();

    expect(cancelAssignment).toHaveBeenCalled();
    expect(confirmDialog().hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the dismissible confirmation dialog with Escape', () => {
    confirmingAdventurer.set(aurelune);
    fixture.detectChanges();
    expect(confirmDialog().hasAttribute('open')).toBe(true);

    confirmDialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(cancelAssignment).toHaveBeenCalled();
    expect(confirmDialog().hasAttribute('open')).toBe(false);
  });

  it('does not cover admin routes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin');
    fixture.detectChanges();

    expect(identityDialog().hasAttribute('open')).toBe(false);
  });

  function identityDialog(): HTMLDialogElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>(
      '.identity-dialog',
    )!;
  }

  function confirmDialog(): HTMLDialogElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>(
      '.confirm-dialog',
    )!;
  }
});
