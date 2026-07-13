import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PublicMapResponse } from '../map-api.models';
import { MapPage } from './map-page';

const mapResponse: PublicMapResponse = {
  vision: {
    id: '40000000-0000-0000-0000-000000000001',
    name: 'Carte voilee',
    descriptionMarkdown: 'La destination reste dissimulée.\n\n- Premier repère visible',
    assetPath: '/assets/maps/map-hidden.png',
    imageAlt: 'Carte de démonstration presque entièrement dissimulée.',
    displayOrder: 1,
  },
  markers: [
    {
      id: '60000000-0000-0000-0000-000000000001',
      title: 'Premier appel',
      positionX: 31.5,
      positionY: 70,
      displayOrder: 1,
      questCode: 'QUEST_1',
    },
  ],
};

describe('MapPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads and renders the active public map with accessible markers', () => {
    const fixture = TestBed.createComponent(MapPage);
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toContain('Chargement de la carte');

    http.expectOne('/api/public/map').flush(mapResponse);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const image = compiled.querySelector('.map-frame img');
    const marker = compiled.querySelector('.map-marker');
    const listLink = compiled.querySelector('.marker-list a');

    expect(text(compiled)).toContain('Carte voilee');
    expect(image?.getAttribute('src')).toBe('/assets/maps/map-hidden.png');
    expect(image?.getAttribute('alt')).toContain('dissimulée');
    expect(marker?.getAttribute('href')).toBe('/notebook/QUEST_1');
    expect(marker?.getAttribute('aria-label')).toContain('Consulter Premier appel');
    expect((marker as HTMLElement).style.left).toBe('31.5%');
    expect((marker as HTMLElement).style.top).toBe('70%');
    expect(listLink?.getAttribute('href')).toBe('/notebook/QUEST_1');
    expect(text(compiled)).toContain('Premier repère visible');
  });

  it('renders an error state when the map API fails', () => {
    const fixture = TestBed.createComponent(MapPage);
    fixture.detectChanges();

    http.expectOne('/api/public/map').flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Impossible de charger la carte');
  });

  it('renders an empty state when no map is active', () => {
    const fixture = TestBed.createComponent(MapPage);
    fixture.detectChanges();

    http.expectOne('/api/public/map').flush({ vision: null, markers: [] });
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toContain("Aucune carte publiée n'est active");
  });

  function text(element: Element): string {
    return element.textContent ?? '';
  }
});
