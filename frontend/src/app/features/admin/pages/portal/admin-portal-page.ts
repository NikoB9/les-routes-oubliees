import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';

import { LoadingIndicatorComponent } from '../../../../shared/components/loading-indicator/loading-indicator';
import {
  AdminAdventurer,
  AdminPortalAssignmentUpdate,
  AdminPortalIdentity,
  PortalAccessMode,
} from '../../admin-api.models';
import { AdminApiService } from '../../admin-api.service';
import { AdminLabelPipe } from '../../shared/admin-label.pipe';

type LoadState = 'loading' | 'ready' | 'error';

interface PortalIdentityControls {
  accessMode: FormControl<PortalAccessMode>;
  adventurerId: FormControl<string>;
}

const PORTAL_GENERIC_ERROR = 'Impossible de mettre à jour les identités.';
const PORTAL_ADVENTURER_TAKEN_ERROR = 'Cet aventurier est déjà attribué à une autre identité.';
const PORTAL_ADVENTURERS_UNAVAILABLE =
  'La liste des aventuriers est indisponible, mais les autres modes restent modifiables.';

@Component({
  selector: 'app-admin-portal-page',
  imports: [LoadingIndicatorComponent, ReactiveFormsModule, AdminLabelPipe],
  templateUrl: './admin-portal-page.html',
  styleUrl: './admin-portal-page.css',
})
export class AdminPortalPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly identityForms = new Map<string, FormGroup<PortalIdentityControls>>();

  protected readonly portalIdentities = signal<AdminPortalIdentity[]>([]);
  protected readonly adventurers = signal<AdminAdventurer[]>([]);
  protected readonly adventurersUnavailable = signal(false);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly portalModes: PortalAccessMode[] = ['UNASSIGNED', 'ADVENTURER', 'GUEST'];

  constructor() {
    this.loadData();
  }

  protected formFor(identity: AdminPortalIdentity): FormGroup<PortalIdentityControls> {
    const existing = this.identityForms.get(identity.id);
    if (existing) {
      return existing;
    }

    const form = new FormGroup<PortalIdentityControls>({
      accessMode: new FormControl(identity.accessMode, { nonNullable: true }),
      adventurerId: new FormControl(identity.adventurerId ?? '', { nonNullable: true }),
    });
    if (this.adventurersUnavailable()) {
      form.controls.adventurerId.disable({ emitEvent: false });
    }
    this.identityForms.set(identity.id, form);
    return form;
  }

  protected assignableAdventurers(identity: AdminPortalIdentity): AdminAdventurer[] {
    return this.adventurers().filter(
      (adventurer) => adventurer.visible || adventurer.id === identity.adventurerId,
    );
  }

  protected updateIdentityMode(identity: AdminPortalIdentity): void {
    const accessMode = this.formFor(identity).controls.accessMode.value;
    this.saveAssignment(identity, {
      accessMode,
      adventurerId: accessMode === 'ADVENTURER' ? identity.adventurerId : null,
    });
  }

  protected updateIdentityAdventurer(identity: AdminPortalIdentity): void {
    const adventurerId = this.formFor(identity).controls.adventurerId.value;
    this.saveAssignment(
      identity,
      adventurerId
        ? { accessMode: 'ADVENTURER', adventurerId }
        : { accessMode: 'UNASSIGNED', adventurerId: null },
    );
  }

  private loadData(): void {
    this.loadState.set('loading');
    forkJoin({
      identities: this.adminApi.listPortalIdentities(),
      adventurers: this.adminApi.listAdventurers().pipe(
        map((items) => ({ items, unavailable: false })),
        catchError(() => of({ items: [] as AdminAdventurer[], unavailable: true })),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ identities, adventurers }) => {
        this.portalIdentities.set(identities);
        this.adventurers.set(adventurers.items);
        this.adventurersUnavailable.set(adventurers.unavailable);
        this.rebuildForms(identities);
        this.loadState.set('ready');
        if (adventurers.unavailable) {
          this.errorMessage.set(PORTAL_ADVENTURERS_UNAVAILABLE);
        }
      },
      error: () => this.showError(undefined, true),
    });
  }

  private reloadIdentities(): void {
    this.adminApi.listPortalIdentities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (identities) => {
        this.portalIdentities.set(identities);
        this.rebuildForms(identities);
      },
      error: () => this.showError(),
    });
  }

  private rebuildForms(identities: AdminPortalIdentity[]): void {
    this.identityForms.clear();
    identities.forEach((identity) => this.formFor(identity));
  }

  private saveAssignment(identity: AdminPortalIdentity, update: AdminPortalAssignmentUpdate): void {
    this.saved.set(false);
    this.adminApi.updatePortalAssignment(identity.id, update).subscribe({
      next: () => {
        this.saved.set(true);
        this.errorMessage.set(null);
        this.reloadIdentities();
      },
      error: (failure: unknown) => this.showError(failure),
    });
  }

  private showError(failure?: unknown, loadFailure = false): void {
    const conflict = failure instanceof HttpErrorResponse && failure.status === 409;
    this.errorMessage.set(conflict ? PORTAL_ADVENTURER_TAKEN_ERROR : PORTAL_GENERIC_ERROR);
    this.saved.set(false);
    if (loadFailure) {
      this.loadState.set('error');
    }
  }
}
