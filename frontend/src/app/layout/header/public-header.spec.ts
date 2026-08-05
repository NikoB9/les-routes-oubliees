import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SiteSettingsApiService } from '../../core/config/site-settings-api.service';
import { PortalIdentityStore } from '../../core/portal/portal-identity.store';
import { PortalIdentity } from '../../core/portal/portal.models';
import { PublicHeaderComponent } from './public-header';

describe('PublicHeaderComponent', () => {
  let fixture: ComponentFixture<PublicHeaderComponent>;
  let identity: WritableSignal<PortalIdentity | null>;
  let canAccessAdmin: WritableSignal<boolean>;

  beforeEach(async () => {
    identity = signal({
      id: 'identity-1',
      accessMode: 'ADVENTURER',
      adventurerId: 'adventurer-1',
      displayName: 'Aurelune la Gardienne des Secrets',
      avatarPath: '/assets/adventurers/aurelune.webp',
      selectedAt: '2026-08-05T12:00:00Z',
    });
    canAccessAdmin = signal(false);

    await TestBed.configureTestingModule({
      imports: [PublicHeaderComponent],
      providers: [
        provideRouter([]),
        {
          provide: SiteSettingsApiService,
          useValue: {
            getPublicSettings: () =>
              of({
                siteName: 'Les Routes Oubliées',
                subtitle: "Compagnie d'Arkhavel",
                logoPath: null,
                timezone: 'Europe/Paris',
                status: 'ONLINE',
                maintenanceMessage: null,
                accessibilityInformationMarkdown: '',
              }),
          },
        },
        {
          provide: PortalIdentityStore,
          useValue: {
            identity,
            canAccessAdmin,
            loading: signal(false),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicHeaderComponent);
    fixture.detectChanges();
  });

  it('shows the adventurer avatar and display name', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector<HTMLImageElement>('.profile-avatar img')?.src).toContain(
      '/assets/adventurers/aurelune.webp',
    );
    expect(compiled.querySelector('.profile-name')?.textContent).toContain('Aurelune');
  });

  it('offers logout only to non-admin users', () => {
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.profile-button');
    button?.click();
    fixture.detectChanges();

    const menuItems = Array.from(root.querySelectorAll('[role="menuitem"]')).map((item) =>
      item.textContent?.trim(),
    );

    expect(menuItems).toEqual(['Se déconnecter']);
    expect(root.querySelector<HTMLAnchorElement>('a[href="/admin"]')).toBeNull();
    expect(root.querySelector<HTMLAnchorElement>('a[href="/cdn-cgi/access/logout"]')).not.toBeNull();
  });

  it('offers administration to admins', () => {
    canAccessAdmin.set(true);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.profile-button');
    button?.click();
    fixture.detectChanges();

    expect(root.querySelector<HTMLAnchorElement>('a[href="/admin"]')?.textContent).toContain(
      'Administration',
    );
  });

  it('closes the profile menu when clicking outside', () => {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.profile-button')?.click();
    fixture.detectChanges();

    expect(root.querySelector('[role="menu"]')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();

    expect(root.querySelector('[role="menu"]')).toBeNull();
  });

  it('keeps the profile menu open when clicking inside it', () => {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.profile-button')?.click();
    fixture.detectChanges();

    root.querySelector<HTMLElement>('.profile-panel')?.click();
    fixture.detectChanges();

    expect(root.querySelector('[role="menu"]')).not.toBeNull();
  });

  it('closes the profile menu with Escape', () => {
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.profile-button');
    button?.click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(root.querySelector('[role="menu"]')).toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  it('gives the profile button an accessible label', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector<HTMLButtonElement>('.profile-button')?.getAttribute('aria-label')).toBe(
      'Menu du profil Aurelune la Gardienne des Secrets',
    );
  });

  it('uses a guest profile without exposing an email address', () => {
    identity.set({
      id: 'identity-2',
      accessMode: 'GUEST',
      adventurerId: null,
      displayName: 'Ombre de la Compagnie',
      avatarPath: null,
      selectedAt: '2026-08-05T12:00:00Z',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.profile-avatar.guest')?.textContent).toContain('?');
    expect(compiled.textContent).toContain('Ombre de la Compagnie');
    expect(compiled.textContent).not.toContain('@');
  });
});
