import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CloudflareAccessSessionService } from '../../core/api/cloudflare-access-session.service';
import { SiteSettingsApiService } from '../../core/config/site-settings-api.service';
import { PortalIdentityStore } from '../../core/portal/portal-identity.store';
import { PortalIdentity } from '../../core/portal/portal.models';
import { PublicHeaderComponent } from './public-header';

describe('PublicHeaderComponent', () => {
  let fixture: ComponentFixture<PublicHeaderComponent>;
  let identity: WritableSignal<PortalIdentity | null>;
  let canAccessAdmin: WritableSignal<boolean>;
  let loading: WritableSignal<boolean>;
  let accessSession: CloudflareAccessSessionService;

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
    loading = signal(false);

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
            loading,
          },
        },
      ],
    }).compileComponents();

    accessSession = TestBed.inject(CloudflareAccessSessionService);
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

  it('exposes a disclosure button instead of an ARIA menu', () => {
    const root = fixture.nativeElement as HTMLElement;
    const button = profileButton();

    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-controls')).toBe('profile-panel');
    expect(button?.hasAttribute('aria-haspopup')).toBe(false);

    button?.click();
    fixture.detectChanges();

    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(panelHidden()).toBe(false);
    expect(root.querySelector('[role="menu"]')).toBeNull();
    expect(root.querySelector('[role="menuitem"]')).toBeNull();
  });

  /**
   * `aria-controls` doit désigner un élément réellement présent : le panneau reste donc dans
   * le document, masqué par `hidden` tant qu'il est fermé.
   */
  it('keeps the controlled panel in the document and hidden while closed', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#profile-panel')).not.toBeNull();
    expect(panelHidden()).toBe(true);
  });

  it('offers a real logout button to a non-administrator', () => {
    const root = fixture.nativeElement as HTMLElement;
    profileButton()?.click();
    fixture.detectChanges();

    const actions = Array.from(root.querySelectorAll('#profile-panel a, #profile-panel button')).map(
      (item) => item.textContent?.trim(),
    );

    expect(actions).toEqual(['Se déconnecter']);
    expect(root.querySelector<HTMLAnchorElement>('a[href="/admin"]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('.profile-logout')?.tagName).toBe('BUTTON');
  });

  it('offers an administration link to admins', () => {
    canAccessAdmin.set(true);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    profileButton()?.click();
    fixture.detectChanges();

    expect(root.querySelector<HTMLAnchorElement>('a[href="/admin"]')?.textContent).toContain(
      'Administration',
    );
  });

  it('closes the panel when clicking outside, including on the logo', () => {
    const root = fixture.nativeElement as HTMLElement;
    profileButton()?.click();
    fixture.detectChanges();
    expect(panelHidden()).toBe(false);

    root.querySelector<HTMLAnchorElement>('.brand')?.click();
    fixture.detectChanges();

    expect(panelHidden()).toBe(true);
    expect(profileButton()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the panel open when clicking inside it', () => {
    const root = fixture.nativeElement as HTMLElement;
    profileButton()?.click();
    fixture.detectChanges();

    root.querySelector<HTMLElement>('.profile-panel')?.click();
    fixture.detectChanges();

    expect(panelHidden()).toBe(false);
  });

  it('closes with Escape and restores the focus to the profile button', () => {
    const button = profileButton();
    button?.click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(panelHidden()).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('gives the profile button an accessible label', () => {
    expect(profileButton()?.getAttribute('aria-label')).toBe(
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

  /**
   * L'identité est encore en mémoire lorsque la session expire : l'état d'expiration doit
   * l'emporter, sans quoi l'en-tête continue de proposer « Se déconnecter » à quelqu'un qui ne
   * l'est plus — le défaut signalé.
   */
  it('replaces the profile menu with a reconnection link once the session expired', () => {
    accessSession.noteExpiredSession();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const link = root.querySelector<HTMLAnchorElement>('.header-action');

    expect(link?.textContent?.trim()).toBe('Se reconnecter');
    expect(link?.getAttribute('href')).toBe('/reconnexion?retour=%2F');
    expect(root.querySelector('.profile-button')).toBeNull();
    expect(root.querySelector('#profile-panel')).toBeNull();
    expect(root.textContent).not.toContain('Se déconnecter');
  });

  /**
   * Le piège central de ce correctif. `routerLink` naviguerait à l'intérieur du routeur, sans
   * jamais atteindre le réseau : Cloudflare ne verrait rien, le lien serait inerte, et aucun
   * autre test ne le dirait — l'attribut `href` étant posé dans les deux cas.
   */
  it('never routes the reconnection link through the Angular router', () => {
    accessSession.noteExpiredSession();
    fixture.detectChanges();

    const routed = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((entry) => entry.nativeElement as HTMLElement);
    const link = (fixture.nativeElement as HTMLElement).querySelector('.header-action');

    expect(link).not.toBeNull();
    expect(routed).not.toContain(link);
  });

  /**
   * Hors ligne, suivre le lien emmènerait sur une adresse volontairement exclue du cache, donc
   * sur la page d'erreur du navigateur, en perdant l'application ouverte.
   */
  it('offers no reconnection while the browser is offline', () => {
    accessSession.noteExpiredSession();
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.header-action')).toBeNull();
    expect(root.querySelector('.header-state')?.textContent?.trim()).toBe('Hors ligne');
  });

  it('recovers the reconnection link when the network comes back', () => {
    accessSession.noteExpiredSession();
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.header-action'),
    ).not.toBeNull();
  });

  /**
   * Le Radar se joue sur le terrain, réseau incertain. Une identité déjà chargée reste vraie
   * hors ligne : la masquer priverait l'aventurier de son nom et de l'accès administration
   * sans rien apporter. Seule la reprise, elle, n'a aucun sens sans réseau.
   */
  it('keeps a loaded identity visible while the browser is offline', () => {
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.profile-button')?.textContent).toContain('Aurelune');
    expect(root.querySelector('.header-state')).toBeNull();
  });

  it('announces the portal while the identity is still loading', () => {
    identity.set(null);
    loading.set(true);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.header-state')?.textContent?.trim()).toBe('Portail');
    expect(root.querySelector('.profile-button')).toBeNull();
  });

  /**
   * Portail en échec sans `401` Cloudflare. Cet état a été la seule impasse de l'en-tête : un
   * constat sans issue, là où le menu de profil offrait au moins une déconnexion. Une navigation
   * à travers Cloudflare répare le cas d'un jeton refusé à l'origine et ne coûte rien aux autres.
   */
  it('offers a retry when the portal is unavailable', () => {
    identity.set(null);
    loading.set(false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const retry = root.querySelector<HTMLAnchorElement>('.header-action');
    const routed = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((entry) => entry.nativeElement as HTMLElement);

    expect(retry?.textContent?.trim()).toBe('Réessayer');
    expect(retry?.getAttribute('href')).toBe('/reconnexion?retour=%2F');
    // WCAG « Label in Name » : le nom accessible contient bien le libellé visible.
    expect(retry?.getAttribute('aria-label')).toBe('Portail indisponible, réessayer');
    expect(root.querySelector('.profile-button')).toBeNull();
    expect(routed).not.toContain(retry);
  });

  function profileButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.profile-button');
  }

  function panelHidden(): boolean {
    const panel = (fixture.nativeElement as HTMLElement).querySelector('#profile-panel');

    expect(panel).not.toBeNull();
    return panel?.hasAttribute('hidden') ?? true;
  }
});
