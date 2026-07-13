import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicContentCacheService } from '../../../core/offline/public-content-cache.service';
import { PublicHomeResponse } from '../home-api.models';
import { HomePage } from './home-page';

const fullHomeResponse: PublicHomeResponse = {
  message: {
    id: '10000000-0000-0000-0000-000000000001',
    title: 'Rassemblement',
    contentHtml: '<p>La Compagnie se <strong>rassemble</strong>.</p><ul><li>Sac pret</li><li>Carte relue</li></ul>',
    importance: 'QUEST_IMMINENT',
    countdownEnabled: false,
    endsAt: null,
    displayTimezone: 'Europe/Paris',
    expiredMessage: null,
  },
  company: {
    id: '20000000-0000-0000-0000-000000000001',
    name: 'Compagnie des Routes Oubliées',
    emblemPath: null,
    imageAlt: null,
    shortDescription: 'Une compagnie prete a repartir.',
    longDescriptionHtml: '<p>Elle avance avec <strong>prudence</strong>.</p>',
  },
  adventurers: [
    {
      id: '30000000-0000-0000-0000-000000000001',
      name: 'Aline des Brumes',
      title: 'Eclaireuse',
      avatarPath: null,
      avatarAlt: null,
      shortDescription: 'Elle ouvre la marche.',
      strengths: 'Observation, discretion',
      weaknesses: 'Impatience',
      displayOrder: 1,
    },
  ],
};

describe('HomePage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PublicContentCacheService,
          useValue: {
            readHome: () => Promise.resolve(null),
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads and renders the public home content', () => {
    const fixture = createComponent();
    fixture.detectChanges();

    expect(text(fixture)).toContain("Chargement de l'accueil");

    flushHome(fullHomeResponse);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(fixture)).toContain('Rassemblement');
    const importanceIcon = compiled.querySelector('.importance-icon');
    expect(importanceIcon?.getAttribute('aria-label')).toBe('Quête imminente');
    expect(importanceIcon?.querySelector('svg')).not.toBeNull();
    expect(text(fixture)).toContain('Sac pret');
    expect(compiled.querySelector('.parchment .markdown-content strong')?.textContent).toBe(
      'rassemble',
    );
    expect(compiled.querySelector('.company-section .markdown-content strong')?.textContent).toBe(
      'prudence',
    );
    expect(text(fixture)).toContain('Compagnie des Routes Oubliées');
    expect(text(fixture)).toContain('Aline des Brumes');
    expect(text(fixture)).toContain('Forces');
    expect(text(fixture)).toContain('Faiblesses');
    expect(compiled.querySelector('[aria-live]')).toBeNull();
  });

  it('renders an accessible error state when the API fails', async () => {
    const fixture = createComponent();
    fixture.detectChanges();

    http.expectOne('/api/public/home').flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Impossible de charger l'accueil");
  });

  it('renders empty states for unpublished home content', () => {
    const fixture = createComponent();
    fixture.detectChanges();

    flushHome({
      message: null,
      company: null,
      adventurers: [],
    });
    fixture.detectChanges();

    expect(text(fixture)).toContain("Aucun parchemin n'est publié");
    expect(text(fixture)).toContain("La présentation de la Compagnie n'est pas encore publiée");
    expect(text(fixture)).toContain("Aucun aventurier n'est visible");
  });

  it('shows the expired countdown message without a live ticking region', () => {
    const fixture = createComponent();
    fixture.detectChanges();

    flushHome({
      ...fullHomeResponse,
      message: {
        ...fullHomeResponse.message!,
        countdownEnabled: true,
        endsAt: '2026-07-11T08:00:00Z',
        expiredMessage: 'Le depart a eu lieu.',
      },
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(fixture)).toContain('Échéance atteinte');
    expect(text(fixture)).toContain('Le depart a eu lieu');
    expect(compiled.querySelector('time')?.getAttribute('datetime')).toBe('2026-07-11T08:00:00Z');
    expect(compiled.querySelector('[aria-live]')).toBeNull();
  });

  function createComponent(): ComponentFixture<HomePage> {
    return TestBed.createComponent(HomePage);
  }

  function flushHome(response: PublicHomeResponse): void {
    http.expectOne('/api/public/home').flush(response);
  }

  function text(fixture: ComponentFixture<HomePage>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});
