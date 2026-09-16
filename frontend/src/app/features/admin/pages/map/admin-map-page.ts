import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import {
  AdminMapMarker,
  AdminMapMarkerUpsert,
  AdminMapPreview,
  AdminMapVision,
  AdminMapVisionUpsert,
  EditorialStatus,
  MapMarkerLabelPosition,
} from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminMedia } from '../../media-api.models';
import { MediaApiService } from '../../media-api.service';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';
import { AdminLabelPipe } from '../../shared/admin-label.pipe';
import { AdminMarkdownEditorComponent } from '../../shared/admin-markdown-editor/admin-markdown-editor';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-map-page',
  imports: [
    ReactiveFormsModule,
    LoadingIndicatorComponent,
    AdminConfirmationDialogComponent,
    AdminLabelPipe,
    AdminMarkdownEditorComponent,
  ],
  templateUrl: './admin-map-page.html',
  styleUrl: './admin-map-page.css',
})
export class AdminMapPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly mediaApi = inject(MediaApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly visionDeleteDialog = viewChild.required<AdminConfirmationDialogComponent>('visionDeleteDialog');
  private readonly markerDeleteDialog = viewChild.required<AdminConfirmationDialogComponent>('markerDeleteDialog');

  protected readonly state = signal<LoadState>('loading');
  protected readonly visions = signal<AdminMapVision[]>([]);
  protected readonly markers = signal<AdminMapMarker[]>([]);
  protected readonly media = signal<AdminMedia[]>([]);
  protected readonly selectedVision = signal<AdminMapVision | null>(null);
  protected readonly selectedMarker = signal<AdminMapMarker | null>(null);
  protected readonly preview = signal<AdminMapPreview | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly savedMessage = signal<string | null>(null);
  protected readonly visionSubmitted = signal(false);
  protected readonly markerSubmitted = signal(false);
  protected readonly pendingVisionDeletion = signal<AdminMapVision | null>(null);
  protected readonly pendingMarkerDeletion = signal<AdminMapMarker | null>(null);
  protected readonly statuses: EditorialStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly labelPositions: ReadonlyArray<{ value: MapMarkerLabelPosition; label: string }> = [
    { value: 'TOP', label: 'Haut' },
    { value: 'BOTTOM', label: 'Bas' },
    { value: 'LEFT', label: 'Gauche' },
    { value: 'RIGHT', label: 'Droite' },
  ];
  protected readonly questCodes = ['QUEST_1', 'QUEST_2', 'QUEST_3', 'QUEST_4', 'VAL_D_AURELUNE'];

  protected readonly visionForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    descriptionMarkdown: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    assetPath: new FormControl('/assets/maps/map-hidden.png', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    imageAlt: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(280)],
    }),
    displayOrder: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(999)],
    }),
    status: new FormControl<EditorialStatus>('DRAFT', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly markerForm = new FormGroup({
    questCode: new FormControl('QUEST_1', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    positionX: new FormControl(50, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
    positionY: new FormControl(50, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
    labelPosition: new FormControl<MapMarkerLabelPosition>('TOP', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    labelOffsetPx: new FormControl(16, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(120)],
    }),
    active: new FormControl(true, { nonNullable: true }),
    displayOrder: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(999)],
    }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    forkJoin({
      visions: this.adminApi.listMapVisions(),
      markers: this.adminApi.listMapMarkers(),
      media: this.mediaApi.listAdminMedia().pipe(
        map((items) => ({ items, unavailable: false })),
        catchError(() => of({ items: [] as AdminMedia[], unavailable: true })),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ visions, markers, media }) => {
          this.visions.set([...visions].sort((left, right) => left.displayOrder - right.displayOrder));
          this.markers.set([...markers].sort((left, right) => left.displayOrder - right.displayOrder));
          this.media.set(media.items);
          this.selectVision(this.visions().find((vision) => vision.active) ?? this.visions()[0] ?? null);
          this.selectMarker(this.markers()[0] ?? null);
          this.state.set('ready');
          if (media.unavailable) {
            this.showError('La médiathèque est indisponible, mais la carte reste modifiable.');
          }
        },
        error: () => {
          this.state.set('error');
          this.showError('Impossible de charger les données de la carte.');
        },
      });
  }

  protected selectVision(vision: AdminMapVision | null): void {
    this.selectedVision.set(vision);
    this.preview.set(null);
    this.clearFeedback();
    this.visionSubmitted.set(false);
    this.visionForm.reset(
      vision
        ? {
            name: vision.name,
            descriptionMarkdown: vision.descriptionMarkdown,
            assetPath: vision.assetPath,
            imageAlt: vision.imageAlt,
            displayOrder: vision.displayOrder,
            status: vision.status,
          }
        : {
            name: '',
            descriptionMarkdown: '',
            assetPath: '/assets/maps/map-hidden.png',
            imageAlt: '',
            displayOrder: this.visions().length + 1,
            status: 'DRAFT',
          },
    );
  }

  protected saveVision(): void {
    this.visionSubmitted.set(true);
    this.clearFeedback();
    if (this.visionForm.invalid) {
      this.visionForm.markAllAsTouched();
      this.showError('Le fond de carte contient des champs obligatoires absents ou invalides.');
      return;
    }
    const selected = this.selectedVision();
    const request = selected
      ? this.adminApi.updateMapVision(selected.id, this.visionPayload())
      : this.adminApi.createMapVision(this.visionPayload());
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.upsertVision(saved);
        this.selectVision(saved);
        this.savedMessage.set(`Le fond « ${saved.name} » a été enregistré.`);
      },
      error: () => this.showError("Impossible d’enregistrer le fond de carte."),
    });
  }

  protected activateVision(vision: AdminMapVision): void {
    this.clearFeedback();
    this.adminApi.activateMapVision(vision.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.visions.update((items) => items.map((item) => ({ ...item, active: item.id === updated.id })));
        this.upsertVision(updated);
        this.selectVision(updated);
        this.savedMessage.set(`Le fond « ${updated.name} » est maintenant actif.`);
      },
      error: () => this.showError("Impossible d’activer ce fond de carte."),
    });
  }

  protected askVisionDeletion(vision: AdminMapVision, event: Event): void {
    this.pendingVisionDeletion.set(vision);
    this.visionDeleteDialog().open(event.currentTarget);
  }

  protected confirmVisionDeletion(): void {
    const vision = this.pendingVisionDeletion();
    if (!vision) return;
    this.pendingVisionDeletion.set(null);
    this.clearFeedback();
    this.adminApi.deleteMapVision(vision.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.visions.update((items) => items.filter((item) => item.id !== vision.id));
        if (this.selectedVision()?.id === vision.id) this.selectVision(null);
        this.savedMessage.set(`Le fond « ${vision.name} » a été supprimé.`);
      },
      error: () => this.showError("Impossible de supprimer ce fond de carte."),
    });
  }

  protected previewVision(vision: AdminMapVision): void {
    this.clearFeedback();
    this.adminApi.previewMap(vision.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => this.preview.set(preview),
      error: () => this.showError('Impossible de générer la prévisualisation de la carte.'),
    });
  }

  protected selectBackground(item: AdminMedia): void {
    this.visionForm.patchValue({ assetPath: item.url, imageAlt: item.altText });
    this.clearFeedback();
  }

  protected selectMarker(marker: AdminMapMarker | null): void {
    this.selectedMarker.set(marker);
    this.clearFeedback();
    this.markerSubmitted.set(false);
    this.markerForm.reset(
      marker
        ? {
            questCode: marker.questCode,
            title: marker.title,
            positionX: marker.positionX,
            positionY: marker.positionY,
            labelPosition: marker.labelPosition,
            labelOffsetPx: marker.labelOffsetPx,
            active: marker.active,
            displayOrder: marker.displayOrder,
          }
        : {
            questCode: 'QUEST_1',
            title: '',
            positionX: 50,
            positionY: 50,
            labelPosition: 'TOP',
            labelOffsetPx: 16,
            active: true,
            displayOrder: this.markers().length + 1,
          },
    );
  }

  protected saveMarker(): void {
    this.markerSubmitted.set(true);
    this.clearFeedback();
    if (this.markerForm.invalid) {
      this.markerForm.markAllAsTouched();
      this.showError('Le repère contient des champs obligatoires absents ou invalides.');
      return;
    }
    const selected = this.selectedMarker();
    const request = selected
      ? this.adminApi.updateMapMarker(selected.id, this.markerPayload())
      : this.adminApi.createMapMarker(this.markerPayload());
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.upsertMarker(saved);
        this.selectMarker(saved);
        this.savedMessage.set(`Le repère « ${saved.title} » a été enregistré.`);
      },
      error: () => this.showError("Impossible d’enregistrer le repère."),
    });
  }

  protected askMarkerDeletion(marker: AdminMapMarker, event: Event): void {
    this.pendingMarkerDeletion.set(marker);
    this.markerDeleteDialog().open(event.currentTarget);
  }

  protected confirmMarkerDeletion(): void {
    const marker = this.pendingMarkerDeletion();
    if (!marker) return;
    this.pendingMarkerDeletion.set(null);
    this.clearFeedback();
    this.adminApi.deleteMapMarker(marker.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.markers.update((items) => items.filter((item) => item.id !== marker.id));
        if (this.selectedMarker()?.id === marker.id) this.selectMarker(null);
        this.savedMessage.set(`Le repère « ${marker.title} » a été supprimé.`);
      },
      error: () => this.showError('Impossible de supprimer ce repère.'),
    });
  }

  protected visionInvalid(controlName: keyof typeof this.visionForm.controls): boolean {
    const control = this.visionForm.controls[controlName];
    return control.invalid && (control.touched || this.visionSubmitted());
  }

  protected markerInvalid(controlName: keyof typeof this.markerForm.controls): boolean {
    const control = this.markerForm.controls[controlName];
    return control.invalid && (control.touched || this.markerSubmitted());
  }

  private visionPayload(): AdminMapVisionUpsert {
    const value = this.visionForm.getRawValue();
    return {
      name: value.name.trim(),
      descriptionMarkdown: value.descriptionMarkdown.trim(),
      assetPath: value.assetPath.trim(),
      imageAlt: value.imageAlt.trim(),
      displayOrder: Number(value.displayOrder),
      status: value.status,
    };
  }

  private markerPayload(): AdminMapMarkerUpsert {
    const value = this.markerForm.getRawValue();
    return {
      questCode: value.questCode,
      title: value.title.trim(),
      positionX: Number(value.positionX),
      positionY: Number(value.positionY),
      labelPosition: value.labelPosition,
      labelOffsetPx: Number(value.labelOffsetPx),
      active: value.active,
      displayOrder: Number(value.displayOrder),
    };
  }

  private upsertVision(saved: AdminMapVision): void {
    this.visions.update((items) => {
      const exists = items.some((item) => item.id === saved.id);
      const updated = exists ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved];
      return updated.sort((left, right) => left.displayOrder - right.displayOrder);
    });
  }

  private upsertMarker(saved: AdminMapMarker): void {
    this.markers.update((items) => {
      const exists = items.some((item) => item.id === saved.id);
      const updated = exists ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved];
      return updated.sort((left, right) => left.displayOrder - right.displayOrder);
    });
  }

  private clearFeedback(): void {
    this.errorMessage.set(null);
    this.savedMessage.set(null);
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    this.savedMessage.set(null);
    window.setTimeout(() => this.errorSummary()?.nativeElement.focus());
  }
}
