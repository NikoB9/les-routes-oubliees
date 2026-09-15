import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AdminRadarPoint } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { MediaApiService } from '../../media-api.service';
import { AdminRadarPage } from './radar-page';

const POINT: AdminRadarPoint = {
  id: 'point-1',
  title: 'Le vieux chêne',
  description: 'Chercher sous les racines.',
  latitude: 47.12345,
  longitude: -1.12345,
  active: true,
  displayOrder: 1,
  sourceImageKey: null,
  imageMediaId: null,
  imageUrl: null,
  imageAltText: null,
  createdAt: '2026-09-14T10:00:00Z',
  updatedAt: '2026-09-14T10:00:00Z',
};

interface RadarHarness {
  importForm: { controls: { file: { setValue(value: File | null): void } } };
  importRadarCarte(): void;
}

describe('AdminRadarPage', () => {
  let importResponse: () => Observable<AdminRadarPoint[]>;
  let mediaResponse: () => Observable<never[]>;
  let importedFile: File | null;

  beforeEach(async () => {
    importResponse = () => of([POINT]);
    mediaResponse = () => of([]);
    importedFile = null;
    await TestBed.configureTestingModule({
      imports: [AdminRadarPage],
      providers: [
        {
          provide: AdminApiService,
          useValue: {
            getRadarSettings: () => of({ treasureVisible: false, treasure: null }),
            listRadarPoints: () => of([]),
            importRadarCarte: (file: File) => {
              importedFile = file;
              return importResponse();
            },
            updateRadarSettings: () => of({ treasureVisible: true, treasure: null }),
            updateRadarPoint: () => of(POINT),
            deleteRadarPoint: () => of(undefined),
          },
        },
        {
          provide: MediaApiService,
          useValue: { listAdminMedia: () => mediaResponse() },
        },
      ],
    }).compileComponents();
  });

  it('importe le fichier .carte puis affiche les points renvoyés', () => {
    const fixture = TestBed.createComponent(AdminRadarPage);
    const component = fixture.componentInstance as unknown as RadarHarness;
    const file = new File(['{}'], 'parcours.carte', { type: 'application/json' });
    component.importForm.controls.file.setValue(file);

    component.importRadarCarte();
    fixture.detectChanges();

    expect(importedFile).toBe(file);
    expect(fixture.nativeElement.textContent).toContain('Le vieux chêne');
  });

  it('affiche un message dédié pour un import trop volumineux', () => {
    importResponse = () =>
      throwError(() => new HttpErrorResponse({ status: 413, error: { detail: 'proxy interne' } }));
    const fixture = TestBed.createComponent(AdminRadarPage);
    const component = fixture.componentInstance as unknown as RadarHarness;
    component.importForm.controls.file.setValue(new File(['{}'], 'large.carte'));

    component.importRadarCarte();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('trop volumineux');
    expect(fixture.nativeElement.textContent).not.toContain('proxy interne');
  });

  it('n’affiche pas un état vide lorsque le chargement échoue', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminRadarPage],
      providers: [
        {
          provide: AdminApiService,
          useValue: {
            getRadarSettings: () =>
              throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'interne' } })),
            listRadarPoints: () => of([]),
          },
        },
        { provide: MediaApiService, useValue: { listAdminMedia: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(AdminRadarPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Aucun point Radar importé');
    expect(fixture.nativeElement.textContent).not.toContain('interne');
  });

  it('laisse le Radar modifiable lorsque seule la médiathèque est indisponible', () => {
    mediaResponse = () => throwError(() => new Error('media'));
    const fixture = TestBed.createComponent(AdminRadarPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('le Radar reste modifiable');
  });
});
