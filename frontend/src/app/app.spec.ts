import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';
import { PublicContentCacheService } from './core/offline/public-content-cache.service';
import { PwaInstallPromptService } from './core/pwa/pwa-install-prompt.service';

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PublicContentCacheService,
          useValue: {
            refreshIfNeeded: () => Promise.resolve(),
            shouldUseOfflineFallback: () => false,
            readSettings: () => Promise.resolve(null),
            writeSettings: () => Promise.resolve(),
          },
        },
        {
          provide: PwaInstallPromptService,
          useValue: {
            canInstall: () => false,
            showIosHelp: () => false,
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function flushSettings(status: 'ONLINE' | 'MAINTENANCE' = 'ONLINE') {
    http.expectOne('/api/public/settings').flush({
      siteName: 'Les Routes Oubliées',
      subtitle: "Compagnie d'Arkhavel",
      logoPath: '/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d',
      timezone: 'Europe/Paris',
      status,
      maintenanceMessage: status === 'MAINTENANCE' ? 'Maintenance courte en cours.' : null,
      accessibilityInformationMarkdown: 'Informations.',
    });
  }

  function flushPortal(canAccessAdmin = false) {
    http.expectOne('/api/portal/me').flush({
      identity: {
        id: 'identity-1',
        accessMode: 'ADVENTURER',
        adventurerId: 'adventurer-1',
        displayName: 'Aurelune la Gardienne des Secrets',
        avatarPath: '/assets/adventurers/aurelune.webp',
        selectedAt: '2026-08-05T12:00:00Z',
      },
      availableAdventurers: [],
      guestAvailable: false,
      canAccessAdmin,
    });
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    flushSettings();
    flushPortal();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application brand', async () => {
    const fixture = TestBed.createComponent(App);
    flushSettings();
    flushPortal();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('Les Routes');
  });

  it('should expose accessible navigation landmarks', async () => {
    const fixture = TestBed.createComponent(App);
    flushSettings();
    flushPortal();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(compiled.querySelector('main')?.id).toBe('main-content');
    expect(compiled.querySelector('.desktop-nav')?.getAttribute('aria-labelledby')).toBe(
      'primary-navigation-title',
    );
    expect(compiled.querySelector('.mobile-nav')?.getAttribute('aria-label')).toBe(
      'Navigation principale mobile',
    );
  });

  it('should render the navigation links once per navigation surface', async () => {
    const fixture = TestBed.createComponent(App);
    flushSettings();
    flushPortal();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const desktopLinks = Array.from(compiled.querySelectorAll('.desktop-nav .link-label')).map(
      (link) => link.textContent?.trim(),
    );
    const mobileLinks = Array.from(compiled.querySelectorAll('.mobile-nav a')).map((link) =>
      link.textContent?.trim(),
    );

    expect(desktopLinks).toEqual(['Accueil', 'Carte', 'Carnet', 'Radar']);
    expect(mobileLinks).toEqual(['Accueil', 'Carte', 'Carnet', 'Radar']);
    expect(compiled.querySelectorAll('.desktop-nav a').length).toBe(4);
    expect(compiled.querySelectorAll('.mobile-nav a').length).toBe(4);
  });

  it('should expose the current adventurer profile in the header', async () => {
    const fixture = TestBed.createComponent(App);
    flushSettings();
    flushPortal();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const profileButton = compiled.querySelector<HTMLButtonElement>('.profile-button');

    expect(profileButton?.textContent).toContain('Aurelune');
    // Panneau de divulgation : aucun modèle ARIA « menu » n'est annoncé.
    expect(profileButton?.getAttribute('aria-expanded')).toBe('false');
    expect(profileButton?.getAttribute('aria-controls')).toBe('profile-panel');
    expect(profileButton?.hasAttribute('aria-haspopup')).toBe(false);
  });

  /**
   * Le bandeau d'expiration a disparu : l'action vit désormais dans l'en-tête. La région
   * d'annonce le remplace, et doit préexister vide — une région créée au moment où elle se
   * remplit n'est annoncée par aucun lecteur d'écran.
   */
  it('should replace the expiry banner with a always-present live region', async () => {
    const fixture = TestBed.createComponent(App);
    flushSettings();
    flushPortal();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const live = compiled.querySelector('p.sr-only[role="status"]');

    expect(compiled.querySelector('.access-reconnect')).toBeNull();
    expect(live).not.toBeNull();
    expect(live?.textContent?.trim()).toBe('');
  });

  it('should render the maintenance banner', async () => {
    const fixture = TestBed.createComponent(App);
    flushSettings('MAINTENANCE');
    flushPortal();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.maintenance-banner')?.textContent).toContain(
      'Maintenance courte en cours.',
    );
  });
});
