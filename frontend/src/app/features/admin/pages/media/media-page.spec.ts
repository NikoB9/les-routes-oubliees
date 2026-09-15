import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { MediaApiService } from '../../media-api.service';
import { AdminMediaPage } from './media-page';

const MEDIA = {
  id: 'media-1',
  originalFilename: 'carte.webp',
  url: '/media/media-1',
  mimeType: 'image/webp',
  sizeBytes: 2048,
  width: 1200,
  height: 760,
  altText: 'Carte révélée',
  createdAt: '2026-09-14T10:00:00Z',
  createdBy: 'admin@example.test',
};

interface MediaHarness {
  uploadForm: {
    controls: {
      file: { setValue(value: File | null): void };
      altText: { setValue(value: string): void };
    };
  };
  uploadMedia(): void;
}

describe('AdminMediaPage', () => {
  let uploadResponse: () => Observable<typeof MEDIA>;
  let uploaded: { file: File; altText: string } | null;
  let listedMedia: typeof MEDIA[];
  let deleteCalls: number;

  beforeEach(async () => {
    uploadResponse = () => of(MEDIA);
    uploaded = null;
    listedMedia = [];
    deleteCalls = 0;
    await TestBed.configureTestingModule({
      imports: [AdminMediaPage],
      providers: [
        {
          provide: MediaApiService,
          useValue: {
            listAdminMedia: () => of(listedMedia),
            uploadAdminMedia: (file: File, altText: string) => {
              uploaded = { file, altText };
              return uploadResponse();
            },
            deleteAdminMedia: () => {
              deleteCalls += 1;
              return of(undefined);
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('affiche un état vide uniquement après le chargement', () => {
    const fixture = TestBed.createComponent(AdminMediaPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Médiathèque');
    expect(fixture.nativeElement.textContent).toContain('Aucun média ajouté');
    expect(fixture.nativeElement.textContent).not.toContain('Impossible de traiter les médias');
  });

  it('conserve le multipart fourni au service et normalise le texte alternatif', () => {
    const fixture = TestBed.createComponent(AdminMediaPage);
    const component = fixture.componentInstance as unknown as MediaHarness;
    const file = new File(['image'], 'carte.webp', { type: 'image/webp' });
    component.uploadForm.controls.file.setValue(file);
    component.uploadForm.controls.altText.setValue('  Carte révélée  ');

    component.uploadMedia();

    expect(uploaded).toEqual({ file, altText: 'Carte révélée' });
  });

  it('affiche un message dédié pour un fichier trop volumineux', () => {
    uploadResponse = () =>
      throwError(() => new HttpErrorResponse({ status: 413, error: { detail: 'interne' } }));
    const fixture = TestBed.createComponent(AdminMediaPage);
    const component = fixture.componentInstance as unknown as MediaHarness;
    component.uploadForm.controls.file.setValue(new File(['image'], 'large.png'));
    component.uploadForm.controls.altText.setValue('Illustration');

    component.uploadMedia();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('trop volumineux');
    expect(fixture.nativeElement.textContent).not.toContain('interne');
  });

  it('ne supprime un média qu’après confirmation explicite', () => {
    listedMedia = [MEDIA];
    const fixture = TestBed.createComponent(AdminMediaPage);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');

    (fixture.nativeElement.querySelector('.media-grid .danger') as HTMLButtonElement).click();
    expect(deleteCalls).toBe(0);

    (dialog.querySelector('.danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(deleteCalls).toBe(1);
    expect(fixture.nativeElement.querySelector('.media-grid')).toBeNull();
  });
});
