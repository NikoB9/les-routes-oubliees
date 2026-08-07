import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { NotebookApiService } from '../../notebook/notebook-api.service';
import { AdminApiService } from '../admin-api.service';
import { MediaApiService } from '../media-api.service';
import { AdminShell } from './admin-shell';

interface DateConversionHarness {
  toOffsetDateTime(value: string | null, timezone: string): string | null;
  toLocalDateTimeInput(value: string | null, timezone: string): string | null;
}

interface MediaUploadHarness {
  selectedFile: { set(value: File | null): void };
  mediaAltText: { set(value: string): void };
  mediaErrorMessage: () => string;
  uploadMedia: () => void;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ASSIGNED_ADVENTURER_ID = '70000000-0000-0000-0000-000000000001';
const HIDDEN_ASSIGNED_ADVENTURER_ID = '70000000-0000-0000-0000-000000000003';

/**
 * Les trois états que les listes déroulantes doivent savoir montrer : une identité associée à
 * un aventurier visible, une invitée sans aventurier, et une associée à un aventurier depuis
 * masqué — le cas où filtrer sans précaution viderait le select.
 */
const PORTAL_IDENTITIES = [
  {
    id: '80000000-0000-0000-0000-000000000001',
    normalizedEmail: 'joueuse@example.test',
    cloudflareSubject: 'subject-1',
    accessMode: 'ADVENTURER',
    adventurerId: ASSIGNED_ADVENTURER_ID,
    adventurerName: 'Maelis',
    selectedAt: '2026-07-13T10:00:00Z',
    createdAt: '2026-07-13T10:00:00Z',
    updatedAt: '2026-07-13T10:00:00Z',
  },
  {
    id: '80000000-0000-0000-0000-000000000002',
    normalizedEmail: 'invite@example.test',
    cloudflareSubject: 'subject-2',
    accessMode: 'GUEST',
    adventurerId: null,
    adventurerName: null,
    selectedAt: '2026-07-13T10:00:00Z',
    createdAt: '2026-07-13T10:00:00Z',
    updatedAt: '2026-07-13T10:00:00Z',
  },
  {
    id: '80000000-0000-0000-0000-000000000003',
    normalizedEmail: 'masquee@example.test',
    cloudflareSubject: 'subject-3',
    accessMode: 'ADVENTURER',
    adventurerId: HIDDEN_ASSIGNED_ADVENTURER_ID,
    adventurerName: 'Sorne',
    selectedAt: '2026-07-13T10:00:00Z',
    createdAt: '2026-07-13T10:00:00Z',
    updatedAt: '2026-07-13T10:00:00Z',
  },
];

const ADVENTURERS = [
  { id: ASSIGNED_ADVENTURER_ID, name: 'Maelis', visible: true, displayOrder: 1 },
  { id: '70000000-0000-0000-0000-000000000002', name: 'Ombre', visible: false, displayOrder: 2 },
  { id: HIDDEN_ASSIGNED_ADVENTURER_ID, name: 'Sorne', visible: false, displayOrder: 3 },
];

/** Le select du mode, puis celui de l'aventurier, pour l'identité affichée à ce rang. */
function portalSelects(compiled: HTMLElement, index: number) {
  const row = compiled.querySelectorAll('.admin-list > li')[index];
  return {
    mode: row?.querySelector<HTMLSelectElement>('select[name="portalMode"]') ?? null,
    adventurer: row?.querySelector<HTMLSelectElement>('select[name="portalAdventurer"]') ?? null,
  };
}

function selectOption(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('AdminShell', () => {
  let sectionParam = 'home';
  let uploadMediaResponse: () => Observable<unknown>;
  let updatePortalAssignmentResponse: () => Observable<unknown>;
  let portalAssignmentPayloads: unknown[];

  beforeEach(async () => {
    sectionParam = 'home';
    uploadMediaResponse = () => of({});
    updatePortalAssignmentResponse = () => of({});
    portalAssignmentPayloads = [];
    globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;

    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: defer(() => of(convertToParamMap({ section: sectionParam }))),
          },
        },
        {
          provide: AdminAuthService,
          useValue: {
            currentSession: () => of({ authenticated: true, email: 'admin@example.test' }),
          },
        },
        {
          provide: AdminApiService,
          useValue: {
            listHomeMessages: () => of([]),
            listMapVisions: () =>
              of([
                {
                  id: '40000000-0000-0000-0000-000000000001',
                  name: 'Carte voilee',
                  descriptionMarkdown: 'Description',
                  assetPath: '/assets/maps/map-hidden.png',
                  imageAlt: 'Carte voilee.',
                  displayOrder: 1,
                  status: 'PUBLISHED',
                  active: true,
                  createdAt: '2026-07-13T10:00:00Z',
                  updatedAt: '2026-07-13T10:00:00Z',
                },
              ]),
            listMapMarkers: () =>
              of([
                {
                  id: '60000000-0000-0000-0000-000000000001',
                  questCode: 'QUEST_1',
                  title: 'Premier appel',
                  positionX: 31.5,
                  positionY: 70,
                  labelPosition: 'BOTTOM',
                  labelOffsetPx: 22,
                  active: true,
                  displayOrder: 1,
                  createdAt: '2026-07-13T10:00:00Z',
                  updatedAt: '2026-07-13T10:00:00Z',
                },
              ]),
            getSiteSettings: () =>
              of({
                id: '60000000-0000-0000-0000-000000000001',
                siteName: 'Les Routes Oubliées',
                subtitle: null,
                logoPath: null,
                timezone: 'Europe/Paris',
                status: 'ONLINE',
                maintenanceMessage: null,
                accessibilityInformationMarkdown: 'Informations.',
                updatedBy: null,
                createdAt: '2026-07-13T10:00:00Z',
                updatedAt: '2026-07-13T10:00:00Z',
              }),
            listPortalIdentities: () => of(PORTAL_IDENTITIES),
            listAdventurers: () => of(ADVENTURERS),
            listAuditLogs: () => of([]),
            updatePortalAssignment: (_id: string, payload: unknown) => {
              portalAssignmentPayloads.push(payload);
              return updatePortalAssignmentResponse();
            },
          },
        },
        {
          provide: NotebookApiService,
          useValue: {
            listAdminQuests: () =>
              of([
                {
                  id: '50000000-0000-0000-0000-000000000001',
                  code: 'QUEST_1',
                  title: 'Quete 1',
                  summary: 'Resume public',
                  importantEventsMarkdown: '',
                  importantEventsHtml: '',
                  discoveredCluesMarkdown: '',
                  discoveredCluesHtml: '',
                  completedTrialsMarkdown: '',
                  completedTrialsHtml: '',
                  extraContentMarkdown: '',
                  extraContentHtml: '',
                  adminDraftMarkdown: '',
                  adminDraftHtml: '',
                  status: 'DRAFT',
                  visibleToPlayers: false,
                  displayOrder: 1,
                  createdAt: '2026-07-13T10:00:00Z',
                  updatedAt: '2026-07-13T10:00:00Z',
                },
              ]),
          },
        },
        {
          provide: MediaApiService,
          useValue: {
            listAdminMedia: () => of([]),
            uploadAdminMedia: () => uploadMediaResponse(),
          },
        },
      ],
    }).compileComponents();
  });

  async function renderPortalSection() {
    sectionParam = 'portal';
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('converts countdown dates between Europe Paris local input and offset ISO values', () => {
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as DateConversionHarness;

    expect(shell.toOffsetDateTime('2026-07-12T20:00', 'Europe/Paris')).toBe(
      '2026-07-12T20:00:00+02:00',
    );
    expect(shell.toOffsetDateTime('2026-12-12T20:00', 'Europe/Paris')).toBe(
      '2026-12-12T20:00:00+01:00',
    );
    expect(shell.toLocalDateTimeInput('2026-07-12T18:00:00Z', 'Europe/Paris')).toBe(
      '2026-07-12T20:00',
    );
  });

  it('shows Markdown tools on quest Markdown fields but not on the public summary', () => {
    sectionParam = 'notebook';
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summary = compiled.querySelector('textarea[name="summary"]');
    const summaryLabel = summary?.closest('label');

    expect(compiled.querySelectorAll('app-markdown-toolbar').length).toBeGreaterThanOrEqual(5);
    expect(summaryLabel?.textContent).toContain('Résumé public');
    expect(summaryLabel?.querySelector('app-markdown-toolbar')).toBeNull();
  });

  it('shows map marker label position controls', async () => {
    sectionParam = 'map';
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const positionSelect = compiled.querySelector<HTMLSelectElement>(
      'select[name="mapMarkerLabelPosition"]',
    );
    const offsetInput = compiled.querySelector<HTMLInputElement>('input[name="mapMarkerLabelOffset"]');

    expect(positionSelect?.value).toBe('BOTTOM');
    expect(Array.from(positionSelect?.options ?? []).map((option) => option.value)).toEqual([
      'TOP',
      'BOTTOM',
      'LEFT',
      'RIGHT',
    ]);
    expect(offsetInput?.value).toBe('22');
  });

  /**
   * Un message unique servait les trois causes et réclamait le texte alternatif quelle que
   * soit la vraie raison : devant un fichier trop lourd, l'administrateur corrigeait un champ
   * déjà valide, puis échouait de nouveau sans jamais apprendre la taille en cause.
   */
  it('explains a rejected upload by its size instead of blaming the alt text', () => {
    uploadMediaResponse = () => throwError(() => new HttpErrorResponse({ status: 413 }));
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as MediaUploadHarness;

    shell.selectedFile.set(new File(['x'], 'carte.png', { type: 'image/png' }));
    shell.mediaAltText.set('Carte révélée');
    shell.uploadMedia();

    expect(shell.mediaErrorMessage()).toContain('trop volumineux');
  });

  it('still names the missing fields when the upload form is incomplete', () => {
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as MediaUploadHarness;

    shell.uploadMedia();

    expect(shell.mediaErrorMessage()).toContain('obligatoires');
  });

  /** Toute autre panne reste distincte de la taille : le conseil serait trompeur. */
  it('does not blame the file size for an unrelated upload failure', () => {
    uploadMediaResponse = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as MediaUploadHarness;

    shell.selectedFile.set(new File(['x'], 'carte.png', { type: 'image/png' }));
    shell.mediaAltText.set('Carte révélée');
    shell.uploadMedia();

    expect(shell.mediaErrorMessage()).not.toContain('trop volumineux');
  });

  /**
   * Le backend rédige ses refus métier dans `detail` : image trop grande, signature invalide.
   * Les remplacer par un message générique reproduirait la confusion que l'on vient de lever.
   */
  it('shows the reason the server gives for a rejected upload', () => {
    uploadMediaResponse = () =>
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { detail: 'Image trop grande : 50 millions de pixels au maximum.' },
      }));
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as MediaUploadHarness;

    shell.selectedFile.set(new File(['x'], 'carte.png', { type: 'image/png' }));
    shell.mediaAltText.set('Carte révélée');
    shell.uploadMedia();

    expect(shell.mediaErrorMessage()).toContain('50 millions de pixels');
  });

  /** Un 5xx ne doit jamais laisser filtrer un détail technique vers l'administrateur. */
  it('never relays a server-side failure detail', () => {
    uploadMediaResponse = () =>
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { detail: 'NullPointerException at MediaService line 42' },
      }));
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance as unknown as MediaUploadHarness;

    shell.selectedFile.set(new File(['x'], 'carte.png', { type: 'image/png' }));
    shell.mediaAltText.set('Carte révélée');
    shell.uploadMedia();

    expect(shell.mediaErrorMessage()).not.toContain('NullPointerException');
  });

  /**
   * Les deux listes retombaient sur leur première option, quel que soit l'état réel :
   * `[value]` était écrit avant que le `@for` n'ait créé les `<option>`, donc ignoré. Un
   * administrateur pilotait à l'aveugle, et ne pouvait pas resélectionner l'état affiché.
   */
  it('preselects the portal dropdowns on each identity current state', async () => {
    const fixture = await renderPortalSection();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(portalSelects(compiled, 0).mode?.value).toBe('ADVENTURER');
    expect(portalSelects(compiled, 0).adventurer?.value).toBe(ASSIGNED_ADVENTURER_ID);
    expect(portalSelects(compiled, 1).mode?.value).toBe('GUEST');
    expect(portalSelects(compiled, 1).adventurer?.value).toBe('');
  });

  /** Le serveur refuse une attribution sans aventurier : l'option ne doit pas être offerte. */
  it('never offers the adventurer mode to an identity without an adventurer', async () => {
    const fixture = await renderPortalSection();
    const compiled = fixture.nativeElement as HTMLElement;

    const assigned = portalSelects(compiled, 0).mode;
    const guest = portalSelects(compiled, 1).mode;
    const optionFor = (select: HTMLSelectElement | null) =>
      Array.from(select?.options ?? []).find((option) => option.value === 'ADVENTURER');

    expect(optionFor(guest)?.disabled).toBe(true);
    expect(optionFor(assigned)?.disabled).toBe(false);
  });

  /** « Aucun » envoyait une attribution sans aventurier, que le serveur rejette en 400. */
  it('puts an identity back to unassigned when its adventurer is removed', async () => {
    const fixture = await renderPortalSection();
    const compiled = fixture.nativeElement as HTMLElement;

    selectOption(portalSelects(compiled, 0).adventurer!, '');

    expect(portalAssignmentPayloads).toEqual([{ accessMode: 'UNASSIGNED', adventurerId: null }]);
  });

  /**
   * Un aventurier masqué est refusé par le serveur, donc jamais proposé — sauf celui déjà
   * attribué, dont le retrait viderait le select et effacerait l'attribution de l'écran.
   */
  it('only offers adventurers the server would accept, plus the one already assigned', async () => {
    const fixture = await renderPortalSection();
    const compiled = fixture.nativeElement as HTMLElement;

    const offered = (index: number) =>
      Array.from(portalSelects(compiled, index).adventurer?.options ?? []).map((option) => option.value);

    expect(offered(0)).toEqual(['', ASSIGNED_ADVENTURER_ID]);
    expect(offered(2)).toEqual(['', ASSIGNED_ADVENTURER_ID, HIDDEN_ASSIGNED_ADVENTURER_ID]);
    expect(portalSelects(compiled, 2).adventurer?.value).toBe(HIDDEN_ASSIGNED_ADVENTURER_ID);
    expect(compiled.textContent).toContain('Sorne (masqué)');
  });

  /**
   * Le bandeau de succès n'était jamais effacé : il restait affiché à vie, puis cohabitait
   * avec celui d'erreur. La liste proposant aussi les aventuriers déjà pris, le conflit est un
   * aboutissement courant et doit se nommer.
   */
  it('does not leave the success banner beside a failure', async () => {
    const fixture = await renderPortalSection();
    const compiled = fixture.nativeElement as HTMLElement;

    selectOption(portalSelects(compiled, 1).adventurer!, ASSIGNED_ADVENTURER_ID);
    fixture.detectChanges();
    expect(compiled.querySelector('.status')?.textContent).toContain('Attribution mise à jour');

    updatePortalAssignmentResponse = () => throwError(() => new HttpErrorResponse({ status: 409 }));
    selectOption(portalSelects(compiled, 1).mode!, 'UNASSIGNED');
    fixture.detectChanges();

    expect(compiled.querySelector('.status')).toBeNull();
    expect(compiled.querySelector('.alert')?.textContent).toContain('déjà attribué');
  });

  it('does not expose a separate admin logout action', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutLink = compiled.querySelector<HTMLAnchorElement>('.logout-button');

    expect(logoutLink).toBeNull();
  });
});
