import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminCompany, AdminCompanyUpdate } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminMarkdownEditorComponent } from '../../shared/admin-markdown-editor/admin-markdown-editor';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-company-page',
  imports: [ReactiveFormsModule, LoadingIndicatorComponent, AdminMarkdownEditorComponent],
  templateUrl: './admin-company-page.html',
  styleUrls: ['../../shared/admin-editor-page.css', './admin-company-page.css'],
})
export class AdminCompanyPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');

  protected readonly state = signal<LoadState>('loading');
  protected readonly company = signal<AdminCompany | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly submitted = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    emblemPath: new FormControl<string | null>(null, [Validators.maxLength(255)]),
    imageAlt: new FormControl<string | null>(null, [Validators.maxLength(280)]),
    shortDescription: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    longDescriptionMarkdown: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.adminApi.getCompany().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (company) => {
        this.company.set(company);
        this.form.reset({
          name: company.name,
          emblemPath: company.emblemPath,
          imageAlt: company.imageAlt,
          shortDescription: company.shortDescription,
          longDescriptionMarkdown: company.longDescriptionMarkdown,
        });
        this.state.set('ready');
      },
      error: () => {
        this.state.set('error');
        this.showError('Impossible de charger la Compagnie.');
      },
    });
  }

  protected save(): void {
    this.submitted.set(true);
    this.saved.set(false);
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showError('La Compagnie contient des champs obligatoires absents ou invalides.');
      return;
    }
    this.adminApi.updateCompany(this.payload()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (company) => {
        this.company.set(company);
        this.form.reset({
          name: company.name,
          emblemPath: company.emblemPath,
          imageAlt: company.imageAlt,
          shortDescription: company.shortDescription,
          longDescriptionMarkdown: company.longDescriptionMarkdown,
        });
        this.submitted.set(false);
        this.saved.set(true);
      },
      error: () => this.showError('Impossible d’enregistrer la Compagnie.'),
    });
  }

  protected invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  private payload(): AdminCompanyUpdate {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      emblemPath: this.trimToNull(value.emblemPath),
      imageAlt: this.trimToNull(value.imageAlt),
      shortDescription: value.shortDescription.trim(),
      longDescriptionMarkdown: value.longDescriptionMarkdown.trim(),
    };
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
