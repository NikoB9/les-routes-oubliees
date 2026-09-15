import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminAllowedEmail, AdminAllowedEmailUpdate } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';

type LoadState = 'loading' | 'ready' | 'error';

const ADMINISTRATOR_ERROR_GENERIC =
  "Impossible de traiter les administrateurs autorisés. Vérifiez l'email et l'invariant du dernier administrateur actif.";
const ADMINISTRATOR_ERROR_REQUIRED_EMAIL = "L'adresse email de l'administrateur est obligatoire.";

@Component({
  selector: 'app-admin-administrators-page',
  imports: [LoadingIndicatorComponent, ReactiveFormsModule, AdminConfirmationDialogComponent],
  templateUrl: './administrators-page.html',
  styleUrl: './administrators-page.css',
})
export class AdminAdministratorsPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly deleteDialog = viewChild.required<AdminConfirmationDialogComponent>('deleteDialog');
  private readonly labelControls = new Map<string, FormControl<string>>();

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly allowedEmails = signal<AdminAllowedEmail[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly saved = signal(false);
  protected readonly pendingDeletion = signal<AdminAllowedEmail | null>(null);
  protected readonly createForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
    label: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
  });

  constructor() {
    this.loadAllowedEmails();
  }

  protected clearFeedback() {
    this.saved.set(false);
    this.errorMessage.set('');
  }

  protected createAllowedEmail() {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      this.showError(ADMINISTRATOR_ERROR_REQUIRED_EMAIL);
      return;
    }

    const value = this.createForm.getRawValue();
    this.adminApi
      .createAllowedEmail({
        email: value.email.trim(),
        label: value.label.trim() || null,
      })
      .subscribe({
        next: (created) => {
          this.allowedEmails.update((items) => [created, ...items]);
          this.labelControls.set(
            created.id,
            new FormControl(created.label ?? '', {
              nonNullable: true,
              validators: [Validators.maxLength(120)],
            }),
          );
          this.createForm.reset({ email: '', label: '' });
          this.saved.set(true);
          this.errorMessage.set('');
        },
        error: (error: unknown) => this.showError(this.problemDetail(error)),
      });
  }

  protected labelControl(id: string): FormControl<string> {
    const control = this.labelControls.get(id);
    if (!control) {
      throw new Error(`Contrôle de libellé introuvable pour ${id}`);
    }
    return control;
  }

  protected updateAllowedEmailLabel(allowedEmail: AdminAllowedEmail) {
    const control = this.labelControl(allowedEmail.id);
    control.markAsTouched();
    if (control.invalid) {
      this.showError('Le libellé interne ne peut pas dépasser 120 caractères.');
      return;
    }
    this.updateAllowedEmail(allowedEmail, {
      label: control.value.trim() || null,
      active: allowedEmail.active,
    });
  }

  protected toggleAllowedEmail(allowedEmail: AdminAllowedEmail) {
    this.updateAllowedEmail(allowedEmail, {
      label: allowedEmail.label,
      active: !allowedEmail.active,
    });
  }

  protected askDeletion(allowedEmail: AdminAllowedEmail, event: Event) {
    this.pendingDeletion.set(allowedEmail);
    this.deleteDialog().open(event.currentTarget);
  }

  protected cancelDeletion() {
    this.pendingDeletion.set(null);
  }

  protected confirmDeletion() {
    const allowedEmail = this.pendingDeletion();
    if (!allowedEmail) return;
    this.pendingDeletion.set(null);
    this.adminApi.deleteAllowedEmail(allowedEmail.id).subscribe({
      next: () => {
        this.allowedEmails.update((items) => items.filter((item) => item.id !== allowedEmail.id));
        this.labelControls.delete(allowedEmail.id);
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.problemDetail(error)),
    });
  }

  private loadAllowedEmails() {
    this.adminApi.listAllowedEmails().subscribe({
      next: (allowedEmails) => {
        this.allowedEmails.set(allowedEmails);
        this.rebuildLabelControls(allowedEmails);
        this.loadState.set('ready');
        this.errorMessage.set('');
      },
      error: (error: unknown) => {
        this.loadState.set('error');
        this.showError(this.problemDetail(error));
      },
    });
  }

  private rebuildLabelControls(allowedEmails: AdminAllowedEmail[]) {
    this.labelControls.clear();
    for (const allowedEmail of allowedEmails) {
      this.labelControls.set(
        allowedEmail.id,
        new FormControl(allowedEmail.label ?? '', {
          nonNullable: true,
          validators: [Validators.maxLength(120)],
        }),
      );
    }
  }

  private updateAllowedEmail(allowedEmail: AdminAllowedEmail, payload: AdminAllowedEmailUpdate) {
    this.saved.set(false);
    this.adminApi.updateAllowedEmail(allowedEmail.id, payload).subscribe({
      next: (updated) => {
        this.allowedEmails.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.labelControl(updated.id).setValue(updated.label ?? '', { emitEvent: false });
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.problemDetail(error)),
    });
  }

  private problemDetail(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return ADMINISTRATOR_ERROR_GENERIC;
    }
    const problem = error.error as { detail?: unknown } | null;
    const detail = typeof problem?.detail === 'string' ? problem.detail.trim() : '';
    return error.status >= 400 && error.status < 500 && detail
      ? detail
      : ADMINISTRATOR_ERROR_GENERIC;
  }

  private showError(message: string) {
    this.saved.set(false);
    this.errorMessage.set(message);
    window.setTimeout(() => this.errorSummary()?.nativeElement.focus());
  }
}
