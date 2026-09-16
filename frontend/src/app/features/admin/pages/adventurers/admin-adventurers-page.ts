import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import { AdminAdventurer, AdminAdventurerUpsert } from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminConfirmationDialogComponent } from '../../shared/admin-confirmation-dialog/admin-confirmation-dialog';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-adventurers-page',
  imports: [ReactiveFormsModule, LoadingIndicatorComponent, AdminConfirmationDialogComponent],
  templateUrl: './admin-adventurers-page.html',
  styleUrls: ['../../shared/admin-editor-page.css', './admin-adventurers-page.css'],
})
export class AdminAdventurersPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly deleteDialog = viewChild.required<AdminConfirmationDialogComponent>('deleteDialog');

  protected readonly state = signal<LoadState>('loading');
  protected readonly adventurers = signal<AdminAdventurer[]>([]);
  protected readonly selected = signal<AdminAdventurer | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly submitted = signal(false);
  protected readonly pendingDeletion = signal<AdminAdventurer | null>(null);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    avatarPath: new FormControl<string | null>(null, [Validators.maxLength(255)]),
    avatarAlt: new FormControl<string | null>(null, [Validators.maxLength(280)]),
    shortDescription: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    strengths: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    weaknesses: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    visible: new FormControl(true, { nonNullable: true }),
    displayOrder: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.adminApi.listAdventurers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (adventurers) => {
        this.adventurers.set([...adventurers].sort((left, right) => left.displayOrder - right.displayOrder));
        this.select(this.adventurers()[0] ?? null);
        this.state.set('ready');
      },
      error: () => {
        this.state.set('error');
        this.showError('Impossible de charger les aventuriers.');
      },
    });
  }

  protected select(adventurer: AdminAdventurer | null): void {
    this.selected.set(adventurer);
    this.saved.set(false);
    this.errorMessage.set(null);
    this.submitted.set(false);
    this.form.reset(adventurer ? {
      name: adventurer.name,
      title: adventurer.title,
      avatarPath: adventurer.avatarPath,
      avatarAlt: adventurer.avatarAlt,
      shortDescription: adventurer.shortDescription,
      strengths: adventurer.strengths,
      weaknesses: adventurer.weaknesses,
      visible: adventurer.visible,
      displayOrder: adventurer.displayOrder,
    } : {
      name: '', title: '', avatarPath: null, avatarAlt: null, shortDescription: '', strengths: '', weaknesses: '',
      visible: true, displayOrder: this.adventurers().length + 1,
    });
  }

  protected save(): void {
    this.submitted.set(true);
    this.saved.set(false);
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showError("L’aventurier contient des champs obligatoires absents ou invalides.");
      return;
    }
    const selected = this.selected();
    const request = selected
      ? this.adminApi.updateAdventurer(selected.id, this.payload())
      : this.adminApi.createAdventurer(this.payload());
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.upsert(saved);
        this.select(saved);
        this.saved.set(true);
      },
      error: () => this.showError("Impossible d’enregistrer l’aventurier."),
    });
  }

  protected move(adventurer: AdminAdventurer, direction: -1 | 1): void {
    const current = this.adventurers();
    const index = current.findIndex((item) => item.id === adventurer.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;
    const reordered = [...current];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    this.adminApi.reorderAdventurers(reordered.map((item) => item.id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.adventurers.set(updated);
        this.saved.set(true);
        this.errorMessage.set(null);
      },
      error: () => this.showError('Impossible de réordonner les aventuriers.'),
    });
  }

  protected askDeletion(adventurer: AdminAdventurer, event: Event): void {
    this.pendingDeletion.set(adventurer);
    this.deleteDialog().open(event.currentTarget);
  }

  protected cancelDeletion(): void {
    this.pendingDeletion.set(null);
  }

  protected confirmDeletion(): void {
    const adventurer = this.pendingDeletion();
    if (!adventurer) return;
    this.pendingDeletion.set(null);
    this.adminApi.deleteAdventurer(adventurer.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.adventurers.update((items) => items.filter((item) => item.id !== adventurer.id));
        if (this.selected()?.id === adventurer.id) this.select(null);
        this.saved.set(true);
      },
      error: () => this.showError("Impossible de supprimer l’aventurier."),
    });
  }

  protected invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  private payload(): AdminAdventurerUpsert {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(), title: value.title.trim(), avatarPath: this.trimToNull(value.avatarPath),
      avatarAlt: this.trimToNull(value.avatarAlt), shortDescription: value.shortDescription.trim(),
      strengths: value.strengths.trim(), weaknesses: value.weaknesses.trim(), visible: value.visible,
      displayOrder: Number(value.displayOrder),
    };
  }

  private upsert(saved: AdminAdventurer): void {
    this.adventurers.update((items) => {
      const exists = items.some((item) => item.id === saved.id);
      const updated = exists ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved];
      return updated.sort((left, right) => left.displayOrder - right.displayOrder);
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    this.saved.set(false);
    window.setTimeout(() => this.errorSummary()?.nativeElement.focus());
  }

  private trimToNull(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed || null;
  }
}
