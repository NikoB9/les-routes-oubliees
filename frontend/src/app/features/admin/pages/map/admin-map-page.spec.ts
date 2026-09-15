import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminApiService } from '../../admin-api.service';
import { MediaApiService } from '../../media-api.service';
import { AdminMapPage } from './admin-map-page';

const VISION = {
  id: 'vision-1', name: 'Aurelune', descriptionMarkdown: 'Ancienne carte', assetPath: '/assets/maps/aurelune.png',
  imageAlt: 'Carte d’Aurelune', displayOrder: 1, status: 'PUBLISHED' as const, active: true,
  createdAt: '2026-09-14T10:00:00Z', updatedAt: '2026-09-14T10:00:00Z',
};

const MARKER = {
  id: 'marker-1', questCode: 'QUEST_1', title: 'La tour', positionX: 12.5, positionY: 33.25,
  labelPosition: 'LEFT' as const, labelOffsetPx: 28, active: true, displayOrder: 1,
  createdAt: '2026-09-14T10:00:00Z', updatedAt: '2026-09-14T10:00:00Z',
};

function api(overrides: Record<string, unknown> = {}) {
  return {
    listMapVisions: () => of([]), listMapMarkers: () => of([]), createMapVision: vi.fn(), updateMapVision: vi.fn(),
    activateMapVision: vi.fn(), deleteMapVision: vi.fn(), previewMap: vi.fn(), createMapMarker: vi.fn(),
    updateMapMarker: vi.fn(), deleteMapMarker: vi.fn(), ...overrides,
  };
}

describe('AdminMapPage', () => {
  it('crée un fond avec un payload normalisé', async () => {
    const createMapVision = vi.fn(() => of(VISION));
    await TestBed.configureTestingModule({
      imports: [AdminMapPage],
      providers: [
        { provide: AdminApiService, useValue: api({ createMapVision }) },
        { provide: MediaApiService, useValue: { listAdminMedia: () => of([]) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminMapPage);
    const component = fixture.componentInstance as unknown as {
      visionForm: { setValue(value: Record<string, unknown>): void };
      saveVision(): void;
    };
    component.visionForm.setValue({
      name: ' Aurelune ', descriptionMarkdown: ' Ancienne carte ', assetPath: ' /assets/maps/aurelune.png ',
      imageAlt: ' Carte d’Aurelune ', displayOrder: 2, status: 'PUBLISHED',
    });
    component.saveVision();
    expect(createMapVision).toHaveBeenCalledWith({
      name: 'Aurelune', descriptionMarkdown: 'Ancienne carte', assetPath: '/assets/maps/aurelune.png',
      imageAlt: 'Carte d’Aurelune', displayOrder: 2, status: 'PUBLISHED',
    });
  });

  it('met à jour un repère avec les valeurs numériques attendues', async () => {
    const updateMapMarker = vi.fn(() => of(MARKER));
    await TestBed.configureTestingModule({
      imports: [AdminMapPage],
      providers: [
        { provide: AdminApiService, useValue: api({ listMapMarkers: () => of([MARKER]), updateMapMarker }) },
        { provide: MediaApiService, useValue: { listAdminMedia: () => of([]) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminMapPage);
    const component = fixture.componentInstance as unknown as {
      markerForm: { patchValue(value: Record<string, unknown>): void };
      saveMarker(): void;
    };
    component.markerForm.patchValue({ title: ' La tour ', positionX: 12.5, positionY: 33.25, labelOffsetPx: 28 });
    component.saveMarker();
    expect(updateMapMarker).toHaveBeenCalledWith('marker-1', {
      questCode: 'QUEST_1', title: 'La tour', positionX: 12.5, positionY: 33.25,
      labelPosition: 'LEFT', labelOffsetPx: 28, active: true, displayOrder: 1,
    });
  });

  it('ne présente pas d’état vide en cas d’échec de chargement', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMapPage],
      providers: [
        { provide: AdminApiService, useValue: api({ listMapVisions: () => throwError(() => new Error('failure')) }) },
        { provide: MediaApiService, useValue: { listAdminMedia: () => of([]) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminMapPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Carte');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });

  it('laisse la carte modifiable lorsque seule la médiathèque est indisponible', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMapPage],
      providers: [
        { provide: AdminApiService, useValue: api({ listMapVisions: () => of([VISION]) }) },
        { provide: MediaApiService, useValue: { listAdminMedia: () => throwError(() => new Error('media')) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminMapPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('la carte reste modifiable');
  });
});
