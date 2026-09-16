import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminRadarPoint, AdminRadarSettings } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminMedia } from '../../media-api.models';
import { MediaApiService } from '../../media-api.service';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';

type LoadState = 'loading' | 'ready' | 'error';
type RadarPointForm = FormGroup<{
  active: FormControl<boolean>;
  imageMediaId: FormControl<string>;
}>;

const RADAR_ERROR_REQUIRED_FILE = 'Le fichier .carte est obligatoire.';
const RADAR_ERROR_FILE_TOO_LARGE =
  'Le fichier .carte est trop volumineux pour être envoyé. Réduisez sa taille avant de recommencer.';
const RADAR_ERROR_GENERIC = 'Impossible de traiter le Radar pour le moment.';

@Component({
  selector: 'app-admin-radar-page',
  imports: [DecimalPipe, LoadingIndicatorComponent, ReactiveFormsModule, AdminConfirmationDialogComponent],
  templateUrl: './radar-page.html',
  styleUrls: ['../../shared/admin-page-base.css', './radar-page.css'],
})
export class AdminRadarPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly mediaApi = inject(MediaApiService);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly deleteDialog = viewChild.required<AdminConfirmationDialogComponent>('deleteDialog');
  private readonly pointForms = new Map<string, RadarPointForm>();

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly radarSettings = signal<AdminRadarSettings | null>(null);
  protected readonly radarPoints = signal<AdminRadarPoint[]>([]);
  protected readonly media = signal<AdminMedia[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly saved = signal(false);
  protected readonly pendingDeletion = signal<AdminRadarPoint | null>(null);
  protected readonly importForm = new FormGroup({
    file: new FormControl<File | null>(null, { validators: [Validators.required] }),
  });
  protected readonly settingsForm = new FormGroup({
    treasureVisible: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.loadRadar();
  }

  protected selectCarteFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.importForm.controls.file.setValue(input.files?.item(0) ?? null);
    this.importForm.controls.file.markAsTouched();
    this.clearFeedback();
  }

  protected clearFeedback() {
    this.saved.set(false);
    this.errorMessage.set('');
  }

  protected importRadarCarte() {
    this.importForm.markAllAsTouched();
    const file = this.importForm.controls.file.value;
    if (!file) {
      this.showError(RADAR_ERROR_REQUIRED_FILE);
      return;
    }

    this.adminApi.importRadarCarte(file).subscribe({
      next: (points) => {
        this.radarPoints.set(points);
        this.rebuildPointForms(points);
        this.importForm.reset({ file: null });
        const input = this.fileInput()?.nativeElement;
        if (input) {
          input.value = '';
        }
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.importErrorMessage(error)),
    });
  }

  protected updateTreasureVisibility() {
    const visible = this.settingsForm.controls.treasureVisible.value;
    this.saved.set(false);
    this.adminApi.updateRadarSettings(visible).subscribe({
      next: (settings) => {
        this.radarSettings.set(settings);
        this.settingsForm.controls.treasureVisible.setValue(settings.treasureVisible, {
          emitEvent: false,
        });
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.problemDetail(error)),
    });
  }

  protected pointForm(id: string): RadarPointForm {
    const form = this.pointForms.get(id);
    if (!form) {
      throw new Error(`Formulaire Radar introuvable pour ${id}`);
    }
    return form;
  }

  protected updateRadarPointActive(point: AdminRadarPoint, active: boolean) {
    this.saveRadarPoint(point, active, this.pointForm(point.id).controls.imageMediaId.value);
  }

  protected updateRadarPointMedia(point: AdminRadarPoint, imageMediaId: string) {
    this.saveRadarPoint(point, this.pointForm(point.id).controls.active.value, imageMediaId);
  }

  protected askDeletion(point: AdminRadarPoint, event: Event) {
    this.pendingDeletion.set(point);
    this.deleteDialog().open(event.currentTarget);
  }

  protected cancelDeletion() {
    this.pendingDeletion.set(null);
  }

  protected confirmDeletion() {
    const point = this.pendingDeletion();
    if (!point) return;
    this.pendingDeletion.set(null);
    this.saved.set(false);
    this.adminApi.deleteRadarPoint(point.id).subscribe({
      next: () => {
        this.radarPoints.update((points) => points.filter((item) => item.id !== point.id));
        this.pointForms.delete(point.id);
        this.saved.set(true);
        this.errorMessage.set('');
      },
      error: (error: unknown) => this.showError(this.problemDetail(error)),
    });
  }

  private loadRadar() {
    forkJoin({
      settings: this.adminApi.getRadarSettings(),
      points: this.adminApi.listRadarPoints(),
      media: this.mediaApi.listAdminMedia().pipe(
        map((items) => ({ items, unavailable: false })),
        catchError(() => of({ items: [] as AdminMedia[], unavailable: true })),
      ),
    }).subscribe({
      next: ({ settings, points, media }) => {
        this.radarSettings.set(settings);
        this.radarPoints.set(points);
        this.media.set(media.items);
        this.settingsForm.controls.treasureVisible.setValue(settings.treasureVisible, {
          emitEvent: false,
        });
        this.rebuildPointForms(points);
        this.loadState.set('ready');
        this.errorMessage.set('');
        if (media.unavailable) {
          this.showError('La médiathèque est indisponible, mais le Radar reste modifiable.');
        }
      },
      error: (error: unknown) => {
        this.loadState.set('error');
        this.showError(this.problemDetail(error));
      },
    });
  }

  private rebuildPointForms(points: AdminRadarPoint[]) {
    this.pointForms.clear();
    for (const point of points) {
      this.pointForms.set(
        point.id,
        new FormGroup({
          active: new FormControl(point.active, { nonNullable: true }),
          imageMediaId: new FormControl(point.imageMediaId ?? '', { nonNullable: true }),
        }),
      );
    }
  }

  private saveRadarPoint(point: AdminRadarPoint, active: boolean, imageMediaId: string) {
    this.saved.set(false);
    this.adminApi
      .updateRadarPoint(point.id, { active, imageMediaId: imageMediaId || null })
      .subscribe({
        next: (updated) => {
          this.radarPoints.update((points) =>
            points.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.pointForm(updated.id).reset({
            active: updated.active,
            imageMediaId: updated.imageMediaId ?? '',
          });
          this.saved.set(true);
          this.errorMessage.set('');
        },
        error: (error: unknown) => this.showError(this.problemDetail(error)),
      });
  }

  private importErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 413) {
      return RADAR_ERROR_FILE_TOO_LARGE;
    }
    return this.problemDetail(error);
  }

  private problemDetail(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return RADAR_ERROR_GENERIC;
    }
    const problem = error.error as { detail?: unknown } | null;
    const detail = typeof problem?.detail === 'string' ? problem.detail.trim() : '';
    return error.status >= 400 && error.status < 500 && detail ? detail : RADAR_ERROR_GENERIC;
  }

  private showError(message: string) {
    this.saved.set(false);
    this.errorMessage.set(message);
    window.setTimeout(() => this.errorSummary()?.nativeElement.focus());
  }
}
