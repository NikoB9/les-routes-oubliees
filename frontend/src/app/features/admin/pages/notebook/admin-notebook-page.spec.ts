import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AdminQuest, AdminQuestUpdate } from '../../../notebook/notebook-api.models';
import { NotebookApiService } from '../../../notebook/notebook-api.service';
import { MediaApiService } from '../../media-api.service';
import { QuestDocumentApiService } from '../../quest-document-api.service';
import { AdminNotebookPage } from './admin-notebook-page';

function quest(index: number): AdminQuest {
  const code = index === 5 ? 'VAL_D_AURELUNE' : `QUEST_${index}`;
  return {
    id: `quest-${index}`,
    code,
    title: `Quête ${index}`,
    summary: `Résumé ${index}`,
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
    displayOrder: index,
    createdAt: '2026-09-14T10:00:00Z',
    updatedAt: '2026-09-14T10:00:00Z',
  };
}

const QUESTS = [1, 2, 3, 4, 5].map(quest);
const QUEST_DOCUMENT = {
  id: 'document-1',
  label: 'Organisation',
  originalFilename: 'organisation.pdf',
  sizeBytes: 1024,
  contentUrl: '/api/admin/quest-tabs/QUEST_1/documents/document-1/content',
  createdAt: '2026-09-14T10:00:00Z',
  uploadedBy: 'admin@example.test',
};

interface NotebookHarness {
  questForm: {
    controls: {
      title: { setValue(value: string): void };
      summary: { setValue(value: string): void };
    };
  };
  documentForm: {
    controls: {
      label: { setValue(value: string): void };
      file: { setValue(value: File | null): void };
    };
  };
  saveQuest(): void;
  uploadDocument(): void;
}

describe('AdminNotebookPage', () => {
  let updatePayload: AdminQuestUpdate | null;
  let uploadResponse: () => Observable<unknown>;
  let deleteDocumentCalls: number;

  beforeEach(async () => {
    updatePayload = null;
    uploadResponse = () => of(QUEST_DOCUMENT);
    deleteDocumentCalls = 0;

    await TestBed.configureTestingModule({
      imports: [AdminNotebookPage],
      providers: [
        {
          provide: NotebookApiService,
          useValue: {
            listAdminQuests: () => of(QUESTS),
            getAdminQuest: (code: string) => of(QUESTS.find((item) => item.code === code)),
            updateAdminQuest: (_code: string, payload: AdminQuestUpdate) => {
              updatePayload = payload;
              return of({ ...QUESTS[0], ...payload });
            },
            previewAdminQuest: () =>
              of({
                importantEventsHtml: '',
                discoveredCluesHtml: '',
                completedTrialsHtml: '',
                extraContentHtml: '',
                adminDraftHtml: '',
              }),
            publishAdminQuest: () => of({ ...QUESTS[0], status: 'PUBLISHED' }),
            hideAdminQuest: () => of({ ...QUESTS[0], visibleToPlayers: false }),
            archiveAdminQuest: () => of({ ...QUESTS[0], status: 'ARCHIVED' }),
          },
        },
        {
          provide: QuestDocumentApiService,
          useValue: {
            listQuestDocuments: () => of([QUEST_DOCUMENT]),
            uploadQuestDocument: () => uploadResponse(),
            deleteQuestDocument: () => {
              deleteDocumentCalls += 1;
              return of(undefined);
            },
          },
        },
        { provide: MediaApiService, useValue: { listAdminMedia: () => of([]) } },
      ],
    }).compileComponents();
  });

  it('expose les cinq quêtes comme de vrais onglets reliés au panneau', () => {
    const fixture = TestBed.createComponent(AdminNotebookPage);
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    const panel = fixture.nativeElement.querySelector('[role="tabpanel"]');

    expect(tabs).toHaveLength(5);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
  });

  it('active l’onglet suivant avec la flèche droite', () => {
    const fixture = TestBed.createComponent(AdminNotebookPage);
    fixture.detectChanges();
    const first = fixture.nativeElement.querySelectorAll('[role="tab"]')[0] as HTMLButtonElement;

    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('normalise le titre et le résumé lors de la sauvegarde', () => {
    const fixture = TestBed.createComponent(AdminNotebookPage);
    const component = fixture.componentInstance as unknown as NotebookHarness;
    component.questForm.controls.title.setValue('  Une quête  ');
    component.questForm.controls.summary.setValue('  Son résumé  ');

    component.saveQuest();

    expect(updatePayload?.title).toBe('Une quête');
    expect(updatePayload?.summary).toBe('Son résumé');
  });

  it('masque le détail technique 5xx d’un dépôt PDF', () => {
    uploadResponse = () =>
      throwError(
        () => new HttpErrorResponse({ status: 500, error: { detail: 'private-storage-path' } }),
      );
    const fixture = TestBed.createComponent(AdminNotebookPage);
    const component = fixture.componentInstance as unknown as NotebookHarness;
    component.documentForm.controls.label.setValue('Organisation');
    component.documentForm.controls.file.setValue(new File(['%PDF-'], 'organisation.pdf'));

    component.uploadDocument();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('private-storage-path');
    expect(fixture.nativeElement.textContent).toContain("Impossible de traiter les documents");
  });

  it('ne supprime un document privé qu’après confirmation explicite', () => {
    const fixture = TestBed.createComponent(AdminNotebookPage);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector(
      'dialog[aria-labelledby="delete-quest-document-title"]',
    ) as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const deleteButton = Array.from(buttons).find((button) =>
      button.textContent?.includes('Supprimer le document Organisation'),
    );

    deleteButton?.click();
    expect(deleteDocumentCalls).toBe(0);

    (dialog.querySelector('.danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(deleteDocumentCalls).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('organisation.pdf');
  });
});
