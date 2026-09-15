import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  AdminQuest,
  AdminQuestPreview,
  AdminQuestUpdate,
  QuestStatus,
} from '../../../notebook/notebook-api.models';
import { NotebookApiService } from '../../../notebook/notebook-api.service';
import { AdminMarkdownEditorComponent } from '../../shared/admin-markdown-editor/admin-markdown-editor';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';
import { AdminLabelPipe } from '../../shared/admin-label.pipe';
import { formatFileSize } from '../../shared/admin-format.utils';
import { AdminQuestDocument } from '../../quest-document-api.models';
import { QuestDocumentApiService } from '../../quest-document-api.service';
import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';

type LoadState = 'loading' | 'ready' | 'error';
type QuestForm = FormGroup<{
  title: FormControl<string>;
  summary: FormControl<string>;
  importantEventsMarkdown: FormControl<string>;
  discoveredCluesMarkdown: FormControl<string>;
  completedTrialsMarkdown: FormControl<string>;
  extraContentMarkdown: FormControl<string>;
  adminDraftMarkdown: FormControl<string>;
  status: FormControl<QuestStatus>;
  visibleToPlayers: FormControl<boolean>;
}>;

const QUEST_ERROR_GENERIC =
  'Impossible de traiter le carnet pour le moment. Vérifiez les champs obligatoires et réessayez.';
const QUEST_ERROR_REQUIRED_FIELDS = 'Le titre et le résumé public sont obligatoires.';
const DOCUMENT_ERROR_REQUIRED_FIELDS = 'Le fichier PDF et le libellé sont obligatoires.';
const DOCUMENT_ERROR_FILE_TOO_LARGE =
  'Le document est trop volumineux pour être envoyé. La limite est de 9 Mio par fichier.';
const DOCUMENT_ERROR_GENERIC =
  "Impossible de traiter les documents d'organisation pour le moment.";

@Component({
  selector: 'app-admin-notebook-page',
  imports: [
    AdminConfirmationDialogComponent,
    AdminLabelPipe,
    AdminMarkdownEditorComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './admin-notebook-page.html',
  styleUrl: './admin-notebook-page.css',
})
export class AdminNotebookPage {
  private readonly notebookApi = inject(NotebookApiService);
  private readonly documentApi = inject(QuestDocumentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly documentErrorSummary = viewChild<ElementRef<HTMLElement>>('documentErrorSummary');
  private readonly documentFileInput = viewChild<ElementRef<HTMLInputElement>>('documentFileInput');
  private readonly questTabs = viewChildren<ElementRef<HTMLButtonElement>>('questTab');
  private readonly archiveDialog = viewChild.required<AdminConfirmationDialogComponent>('archiveDialog');
  private readonly documentDeleteDialog = viewChild.required<AdminConfirmationDialogComponent>('documentDeleteDialog');

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly quests = signal<AdminQuest[]>([]);
  protected readonly selectedQuest = signal<AdminQuest | null>(null);
  protected readonly preview = signal<AdminQuestPreview | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly saved = signal(false);
  protected readonly documentsState = signal<LoadState>('loading');
  protected readonly documents = signal<AdminQuestDocument[]>([]);
  protected readonly documentErrorMessage = signal('');
  protected readonly documentSaved = signal(false);
  protected readonly pendingDocumentDeletion = signal<AdminQuestDocument | null>(null);
  protected readonly statuses: readonly QuestStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly formatFileSize = formatFileSize;

  protected readonly questForm: QuestForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    summary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(700)],
    }),
    importantEventsMarkdown: new FormControl('', { nonNullable: true }),
    discoveredCluesMarkdown: new FormControl('', { nonNullable: true }),
    completedTrialsMarkdown: new FormControl('', { nonNullable: true }),
    extraContentMarkdown: new FormControl('', { nonNullable: true }),
    adminDraftMarkdown: new FormControl('', { nonNullable: true }),
    status: new FormControl<QuestStatus>('DRAFT', { nonNullable: true }),
    visibleToPlayers: new FormControl(false, { nonNullable: true }),
  });

  protected readonly documentForm = new FormGroup({
    label: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    file: new FormControl<File | null>(null, { validators: [Validators.required] }),
  });

  constructor() {
    this.questForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.preview.set(null);
      this.saved.set(false);
      this.errorMessage.set('');
    });
    this.documentForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.documentSaved.set(false);
      this.documentErrorMessage.set('');
    });
    this.loadQuests();
  }

  protected selectQuest(code: string) {
    const listed = this.quests().find((quest) => quest.code === code);
    if (!listed) {
      return;
    }
    this.setSelectedQuest(listed);
    this.saved.set(false);
    this.errorMessage.set('');
    this.notebookApi.getAdminQuest(code).subscribe({
      next: (quest) => {
        if (this.selectedQuest()?.code !== code) {
          return;
        }
        this.replaceQuest(quest);
        this.setSelectedQuest(quest);
      },
      error: (error: unknown) => this.showError(this.problemDetail(error, QUEST_ERROR_GENERIC)),
    });
  }

  protected handleTabKeydown(event: KeyboardEvent, index: number) {
    let targetIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      targetIndex = (index + 1) % this.quests().length;
    } else if (event.key === 'ArrowLeft') {
      targetIndex = (index - 1 + this.quests().length) % this.quests().length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = this.quests().length - 1;
    }
    if (targetIndex === null || targetIndex < 0) {
      return;
    }
    event.preventDefault();
    const quest = this.quests()[targetIndex];
    if (quest) {
      this.questTabs()[targetIndex]?.nativeElement.focus();
      this.selectQuest(quest.code);
    }
  }

  protected saveQuest() {
    const quest = this.selectedQuest();
    this.questForm.markAllAsTouched();
    if (!quest || this.questForm.invalid) {
      this.showError(QUEST_ERROR_REQUIRED_FIELDS);
      return;
    }
    this.notebookApi.updateAdminQuest(quest.code, this.normalizedPayload()).subscribe({
      next: (updated) => this.acceptUpdatedQuest(updated),
      error: (error: unknown) => this.showError(this.problemDetail(error, QUEST_ERROR_GENERIC)),
    });
  }

  protected previewQuest() {
    this.questForm.markAllAsTouched();
    if (this.questForm.invalid) {
      this.showError(QUEST_ERROR_REQUIRED_FIELDS);
      return;
    }
    this.notebookApi.previewAdminQuest(this.normalizedPayload()).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.problemDetail(error, QUEST_ERROR_GENERIC)),
    });
  }

  protected publishQuest() {
    this.applyQuestAction((code) => this.notebookApi.publishAdminQuest(code, true));
  }

  protected hideQuest() {
    this.applyQuestAction((code) => this.notebookApi.hideAdminQuest(code));
  }

  protected askArchive(event: Event) {
    if (this.selectedQuest()) {
      this.archiveDialog().open(event.currentTarget);
    }
  }

  protected confirmArchive() {
    this.applyQuestAction((code) => this.notebookApi.archiveAdminQuest(code));
  }

  protected selectDocumentFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.documentForm.controls.file.setValue(input.files?.item(0) ?? null);
    this.documentForm.controls.file.markAsTouched();
  }

  protected uploadDocument() {
    const quest = this.selectedQuest();
    this.documentForm.markAllAsTouched();
    const file = this.documentForm.controls.file.value;
    const label = this.documentForm.controls.label.value.trim();
    if (!quest || !file || !label || this.documentForm.invalid) {
      this.showDocumentError(DOCUMENT_ERROR_REQUIRED_FIELDS);
      return;
    }
    this.documentApi.uploadQuestDocument(quest.code, file, label).subscribe({
      next: (created) => {
        this.documents.update((items) => [created, ...items]);
        this.documentForm.reset({ label: '', file: null });
        const input = this.documentFileInput()?.nativeElement;
        if (input) {
          input.value = '';
        }
        this.documentSaved.set(true);
        this.documentErrorMessage.set('');
      },
      error: (error: unknown) => this.showDocumentError(this.documentUploadError(error)),
    });
  }

  protected askDocumentDeletion(document: AdminQuestDocument, event: Event) {
    this.pendingDocumentDeletion.set(document);
    this.documentDeleteDialog().open(event.currentTarget);
  }

  protected confirmDocumentDeletion() {
    const document = this.pendingDocumentDeletion();
    const quest = this.selectedQuest();
    if (!quest || !document) {
      return;
    }
    this.pendingDocumentDeletion.set(null);
    this.documentApi.deleteQuestDocument(quest.code, document.id).subscribe({
      next: () => {
        this.documents.update((items) => items.filter((item) => item.id !== document.id));
        this.documentSaved.set(true);
        this.documentErrorMessage.set('');
      },
      error: (error: unknown) =>
        this.showDocumentError(this.problemDetail(error, DOCUMENT_ERROR_GENERIC)),
    });
  }

  private loadQuests() {
    this.notebookApi.listAdminQuests().subscribe({
      next: (quests) => {
        this.quests.set(quests);
        this.loadState.set('ready');
        const first = quests[0] ?? null;
        if (first) {
          this.setSelectedQuest(first);
        } else {
          this.documentsState.set('ready');
        }
      },
      error: (error: unknown) => {
        this.loadState.set('error');
        this.showError(this.problemDetail(error, QUEST_ERROR_GENERIC));
      },
    });
  }

  private setSelectedQuest(quest: AdminQuest) {
    const changedQuest = this.selectedQuest()?.code !== quest.code;
    this.selectedQuest.set(quest);
    this.questForm.reset(
      {
        title: quest.title,
        summary: quest.summary,
        importantEventsMarkdown: quest.importantEventsMarkdown,
        discoveredCluesMarkdown: quest.discoveredCluesMarkdown,
        completedTrialsMarkdown: quest.completedTrialsMarkdown,
        extraContentMarkdown: quest.extraContentMarkdown,
        adminDraftMarkdown: quest.adminDraftMarkdown,
        status: quest.status,
        visibleToPlayers: quest.visibleToPlayers,
      },
      { emitEvent: false },
    );
    this.preview.set(null);
    if (changedQuest) {
      this.loadDocuments(quest.code);
    }
  }

  private loadDocuments(questCode: string) {
    this.documentsState.set('loading');
    this.documents.set([]);
    this.documentForm.reset({ label: '', file: null }, { emitEvent: false });
    this.documentApi.listQuestDocuments(questCode).subscribe({
      next: (documents) => {
        if (this.selectedQuest()?.code !== questCode) {
          return;
        }
        this.documents.set(documents);
        this.documentsState.set('ready');
        this.documentErrorMessage.set('');
      },
      error: (error: unknown) => {
        if (this.selectedQuest()?.code !== questCode) {
          return;
        }
        this.documentsState.set('error');
        this.showDocumentError(this.problemDetail(error, DOCUMENT_ERROR_GENERIC));
      },
    });
  }

  private normalizedPayload(): AdminQuestUpdate {
    const value = this.questForm.getRawValue();
    return {
      title: value.title.trim(),
      summary: value.summary.trim(),
      importantEventsMarkdown: value.importantEventsMarkdown.trim(),
      discoveredCluesMarkdown: value.discoveredCluesMarkdown.trim(),
      completedTrialsMarkdown: value.completedTrialsMarkdown.trim(),
      extraContentMarkdown: value.extraContentMarkdown.trim(),
      adminDraftMarkdown: value.adminDraftMarkdown.trim(),
      status: value.status,
      visibleToPlayers: value.visibleToPlayers,
    };
  }

  private replaceQuest(updated: AdminQuest) {
    this.quests.update((quests) =>
      quests.map((quest) => (quest.code === updated.code ? updated : quest)),
    );
  }

  private acceptUpdatedQuest(updated: AdminQuest) {
    this.replaceQuest(updated);
    this.setSelectedQuest(updated);
    this.saved.set(true);
    this.errorMessage.set('');
  }

  private applyQuestAction(request: (code: string) => ReturnType<NotebookApiService['hideAdminQuest']>) {
    const quest = this.selectedQuest();
    if (!quest) {
      return;
    }
    request(quest.code).subscribe({
      next: (updated) => this.acceptUpdatedQuest(updated),
      error: (error: unknown) => this.showError(this.problemDetail(error, QUEST_ERROR_GENERIC)),
    });
  }

  private documentUploadError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 413) {
      return DOCUMENT_ERROR_FILE_TOO_LARGE;
    }
    return this.problemDetail(error, DOCUMENT_ERROR_GENERIC);
  }

  private problemDetail(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    const problem = error.error as { detail?: unknown } | null;
    const detail = typeof problem?.detail === 'string' ? problem.detail.trim() : '';
    return error.status >= 400 && error.status < 500 && detail ? detail : fallback;
  }

  private showError(message: string) {
    this.saved.set(false);
    this.errorMessage.set(message);
    window.setTimeout(() => this.errorSummary()?.nativeElement.focus());
  }

  private showDocumentError(message: string) {
    this.documentSaved.set(false);
    this.documentErrorMessage.set(message);
    window.setTimeout(() => this.documentErrorSummary()?.nativeElement.focus());
  }
}
