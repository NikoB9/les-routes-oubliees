import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminSiteSettings, AdminSiteSettingsUpdate, SiteStatus } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminMarkdownEditorComponent } from '../../shared/admin-markdown-editor/admin-markdown-editor';
import { AdminLabelPipe } from '../../shared/admin-label.pipe';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-settings-page',
  imports: [ReactiveFormsModule, LoadingIndicatorComponent, AdminMarkdownEditorComponent, AdminLabelPipe],
  templateUrl: './admin-settings-page.html',
  styleUrls: ['../../shared/admin-editor-page.css', './admin-settings-page.css'],
})
export class AdminSettingsPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');

  protected readonly state = signal<LoadState>('loading');
  protected readonly settings = signal<AdminSiteSettings | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly submitted = signal(false);
  protected readonly statuses: SiteStatus[] = ['ONLINE', 'MAINTENANCE'];
  protected readonly form = new FormGroup({
    siteName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    subtitle: new FormControl<string | null>(null, [Validators.maxLength(180)]),
    logoPath: new FormControl<string | null>(null, [Validators.maxLength(255)]),
    timezone: new FormControl('Europe/Paris', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    status: new FormControl<SiteStatus>('ONLINE', { nonNullable: true, validators: [Validators.required] }),
    maintenanceMessage: new FormControl<string | null>(null, [Validators.maxLength(500)]),
    accessibilityInformationMarkdown: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(4000)] }),
  });

  constructor() {
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.configureMaintenanceValidation(status));
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.adminApi.getSiteSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.patch(settings);
        this.state.set('ready');
      },
      error: () => {
        this.state.set('error');
        this.showError('Impossible de charger les paramètres du site.');
      },
    });
  }

  protected save(): void {
    this.submitted.set(true);
    this.saved.set(false);
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showError('Les paramètres contiennent des champs obligatoires absents ou invalides.');
      return;
    }
    this.adminApi.updateSiteSettings(this.payload()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.patch(settings);
        this.submitted.set(false);
        this.saved.set(true);
      },
      error: () => this.showError('Impossible d’enregistrer les paramètres du site.'),
    });
  }

  protected invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  private patch(settings: AdminSiteSettings): void {
    this.form.reset({
      siteName: settings.siteName, subtitle: settings.subtitle, logoPath: settings.logoPath,
      timezone: settings.timezone, status: settings.status, maintenanceMessage: settings.maintenanceMessage,
      accessibilityInformationMarkdown: settings.accessibilityInformationMarkdown,
    });
    this.configureMaintenanceValidation(settings.status);
  }

  private payload(): AdminSiteSettingsUpdate {
    const value = this.form.getRawValue();
    return {
      siteName: value.siteName.trim(), subtitle: this.trimToNull(value.subtitle), logoPath: this.trimToNull(value.logoPath),
      timezone: value.timezone.trim(), status: value.status,
      maintenanceMessage: value.status === 'MAINTENANCE' ? this.trimToNull(value.maintenanceMessage) : null,
      accessibilityInformationMarkdown: value.accessibilityInformationMarkdown.trim(),
    };
  }

  private configureMaintenanceValidation(status: SiteStatus): void {
    this.form.controls.maintenanceMessage.setValidators(status === 'MAINTENANCE'
      ? [Validators.required, Validators.maxLength(500)]
      : [Validators.maxLength(500)]);
    this.form.controls.maintenanceMessage.updateValueAndValidity({ emitEvent: false });
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
