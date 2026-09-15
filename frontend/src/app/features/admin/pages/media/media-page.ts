import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminMedia } from '../../media-api.models';
import { MediaApiService } from '../../media-api.service';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';
import { formatFileSize } from '../../shared/admin-format.utils';

type LoadState = 'loading' | 'ready' | 'error';

const MEDIA_ERROR_REQUIRED_FIELDS = 'Le fichier et le texte alternatif sont obligatoires.';
const MEDIA_ERROR_FILE_TOO_LARGE =
  "Le fichier est trop volumineux pour être envoyé. Choisissez une image plus légère, ou réduisez sa définition avant de la déposer.";
const MEDIA_ERROR_GENERIC = 'Impossible de traiter les médias pour le moment.';

@Component({
  selector: 'app-admin-media-page',
  imports: [LoadingIndicatorComponent, ReactiveFormsModule, AdminConfirmationDialogComponent],
  templateUrl: './media-page.html',
  styleUrl: './media-page.css',
})
export class AdminMediaPage {
  private readonly mediaApi = inject(MediaApiService);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly deleteDialog = viewChild.required<AdminConfirmationDialogComponent>('deleteDialog');

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly media = signal<AdminMedia[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly saved = signal(false);
  protected readonly pendingDeletion = signal<AdminMedia | null>(null);
  protected readonly uploadForm = new FormGroup({
    file: new FormControl<File | null>(null, { validators: [Validators.required] }),
    altText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(280)],
    }),
  });

  constructor() {
    this.loadMedia();
  }

  protected selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.uploadForm.controls.file.setValue(input.files?.item(0) ?? null);
    this.uploadForm.controls.file.markAsTouched();
    this.clearFeedback();
  }

  protected clearFeedback() {
    this.saved.set(false);
    if (this.loadState() === 'ready') {
      this.errorMessage.set('');
    }
  }

  protected uploadMedia() {
    this.uploadForm.markAllAsTouched();
    const file = this.uploadForm.controls.file.value;
    const altText = this.uploadForm.controls.altText.value.trim();
    if (this.uploadForm.invalid || !file || !altText) {
      this.showError(MEDIA_ERROR_REQUIRED_FIELDS);
      return;
    }

    this.mediaApi.uploadAdminMedia(file, altText).subscribe({
      next: (created) => {
        this.media.update((items) => [created, ...items]);
        this.uploadForm.reset({ file: null, altText: '' });
        const input = this.fileInput()?.nativeElement;
        if (input) {
          input.value = '';
        }
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.uploadErrorMessage(error)),
    });
  }

  protected askDeletion(item: AdminMedia, event: Event) {
    this.pendingDeletion.set(item);
    this.deleteDialog().open(event.currentTarget);
  }

  protected cancelDeletion() {
    this.pendingDeletion.set(null);
  }

  protected confirmDeletion() {
    const item = this.pendingDeletion();
    if (!item) return;
    this.pendingDeletion.set(null);
    this.mediaApi.deleteAdminMedia(item.id).subscribe({
      next: () => {
        this.media.update((items) => items.filter((candidate) => candidate.id !== item.id));
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.problemDetail(error, MEDIA_ERROR_GENERIC)),
    });
  }

  protected formatFileSize(sizeBytes: number): string {
    return formatFileSize(sizeBytes);
  }

  private loadMedia() {
    this.mediaApi.listAdminMedia().subscribe({
      next: (items) => {
        this.media.set(items);
        this.loadState.set('ready');
        this.errorMessage.set('');
      },
      error: (error: unknown) => {
        this.loadState.set('error');
        this.showError(this.problemDetail(error, MEDIA_ERROR_GENERIC));
      },
    });
  }

  private uploadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 413) {
      return MEDIA_ERROR_FILE_TOO_LARGE;
    }
    return this.problemDetail(error, MEDIA_ERROR_GENERIC);
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
}
