import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import {
  AdminHomeMessage,
  AdminHomeMessageUpsert,
  EditorialStatus,
  HomeMessageImportance,
} from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { toLocalDateTimeInput, toOffsetDateTime } from '../../shared/admin-format.utils';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';
import { AdminLabelPipe } from '../../shared/admin-label.pipe';
import { AdminMarkdownEditorComponent } from '../../shared/admin-markdown-editor/admin-markdown-editor';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-home-page',
  imports: [
    ReactiveFormsModule,
    LoadingIndicatorComponent,
    AdminConfirmationDialogComponent,
    AdminLabelPipe,
    AdminMarkdownEditorComponent,
  ],
  templateUrl: './admin-home-page.html',
  styleUrls: ['../../shared/admin-editor-page.css', './admin-home-page.css'],
})
export class AdminHomePage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly deleteDialog = viewChild.required<AdminConfirmationDialogComponent>('deleteDialog');

  protected readonly state = signal<LoadState>('loading');
  protected readonly messages = signal<AdminHomeMessage[]>([]);
  protected readonly selected = signal<AdminHomeMessage | null>(null);
  protected readonly timezone = signal('Europe/Paris');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly submitted = signal(false);
  protected readonly pendingDeletion = signal<AdminHomeMessage | null>(null);
  protected readonly statuses: EditorialStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly importances: HomeMessageImportance[] = [
    'INFORMATION',
    'WARNING',
    'QUEST_IMMINENT',
    'SUCCESS',
    'MYSTERY',
  ];

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    contentMarkdown: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    importance: new FormControl<HomeMessageImportance>('INFORMATION', { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<EditorialStatus>('DRAFT', { nonNullable: true, validators: [Validators.required] }),
    countdownEnabled: new FormControl(false, { nonNullable: true }),
    endsAt: new FormControl<string | null>(null),
    expiredMessage: new FormControl<string | null>(null, [Validators.maxLength(280)]),
  });

  constructor() {
    this.form.controls.countdownEnabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.configureCountdownValidation(enabled));
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    forkJoin({
      messages: this.adminApi.listHomeMessages(),
      settings: this.adminApi.getSiteSettings(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ messages, settings }) => {
          this.messages.set(messages);
          this.timezone.set(settings.timezone);
          this.select(messages[0] ?? null);
          this.state.set('ready');
        },
        error: () => {
          this.state.set('error');
          this.showError("Impossible de charger les parchemins d'accueil.");
        },
      });
  }

  protected select(message: AdminHomeMessage | null): void {
    this.selected.set(message);
    this.saved.set(false);
    this.errorMessage.set(null);
    this.submitted.set(false);
    const value = message
      ? {
          title: message.title,
          contentMarkdown: message.contentMarkdown,
          importance: message.importance,
          status: message.status,
          countdownEnabled: message.countdownEnabled,
          endsAt: toLocalDateTimeInput(message.endsAt, this.timezone()),
          expiredMessage: message.expiredMessage,
        }
      : {
          title: '',
          contentMarkdown: '',
          importance: 'INFORMATION' as const,
          status: 'DRAFT' as const,
          countdownEnabled: false,
          endsAt: null,
          expiredMessage: null,
        };
    this.form.reset(value);
    this.configureCountdownValidation(value.countdownEnabled);
  }

  protected save(): void {
    this.submitted.set(true);
    this.saved.set(false);
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showError('Le parchemin contient des champs obligatoires absents ou invalides.');
      return;
    }

    const message = this.selected();
    const request = message
      ? this.adminApi.updateHomeMessage(message.id, this.payload())
      : this.adminApi.createHomeMessage(this.payload());
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.upsert(saved);
        this.select(saved);
        this.saved.set(true);
      },
      error: () => this.showError('Impossible d’enregistrer le parchemin.'),
    });
  }

  protected activate(message: AdminHomeMessage): void {
    this.saved.set(false);
    this.errorMessage.set(null);
    this.adminApi.activateHomeMessage(message.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.messages.update((items) => items.map((item) => ({ ...item, active: item.id === updated.id })));
        this.upsert(updated);
        this.select(updated);
        this.saved.set(true);
      },
      error: () => this.showError('Impossible d’activer le parchemin.'),
    });
  }

  protected askDeletion(message: AdminHomeMessage, event: Event): void {
    this.pendingDeletion.set(message);
    this.deleteDialog().open(event.currentTarget);
  }

  protected cancelDeletion(): void {
    this.pendingDeletion.set(null);
  }

  protected confirmDeletion(): void {
    const message = this.pendingDeletion();
    if (!message) {
      return;
    }
    this.pendingDeletion.set(null);
    this.saved.set(false);
    this.errorMessage.set(null);
    this.adminApi.deleteHomeMessage(message.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messages.update((items) => items.filter((item) => item.id !== message.id));
        if (this.selected()?.id === message.id) {
          this.select(null);
        }
        this.saved.set(true);
      },
      error: () => this.showError('Impossible de supprimer le parchemin.'),
    });
  }

  protected invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  private payload(): AdminHomeMessageUpsert {
    const value = this.form.getRawValue();
    return {
      title: value.title.trim(),
      contentMarkdown: value.contentMarkdown.trim(),
      importance: value.importance,
      status: value.status,
      countdownEnabled: value.countdownEnabled,
      endsAt: value.countdownEnabled ? toOffsetDateTime(value.endsAt, this.timezone()) : null,
      expiredMessage: this.trimToNull(value.expiredMessage),
    };
  }

  private configureCountdownValidation(enabled: boolean): void {
    this.form.controls.endsAt.setValidators(enabled ? [Validators.required] : []);
    this.form.controls.endsAt.updateValueAndValidity({ emitEvent: false });
  }

  private upsert(saved: AdminHomeMessage): void {
    this.messages.update((items) => {
      const exists = items.some((item) => item.id === saved.id);
      return exists ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items];
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    window.setTimeout(() => this.errorSummary()?.nativeElement.focus());
  }

  private trimToNull(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed || null;
  }

}
