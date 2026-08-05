import { computed, inject, Injectable, signal } from '@angular/core';

import { PortalApiService } from './portal-api.service';
import { PortalAdventurerChoice, PortalMe } from './portal.models';

@Injectable({ providedIn: 'root' })
export class PortalIdentityStore {
  private readonly api = inject(PortalApiService);

  readonly portal = signal<PortalMe | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);
  readonly assignmentConflict = signal(false);
  readonly confirmingAdventurer = signal<PortalAdventurerChoice | null>(null);

  readonly identity = computed(() => this.portal()?.identity ?? null);
  readonly canAccessAdmin = computed(() => this.portal()?.canAccessAdmin ?? false);
  readonly needsAssignment = computed(() => this.identity()?.accessMode === 'UNASSIGNED');
  readonly assigned = computed(() => {
    const mode = this.identity()?.accessMode;
    return mode === 'ADVENTURER' || mode === 'GUEST';
  });

  load(force = false): void {
    if (this.loading() || (this.loaded() && !force)) {
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.api.me().subscribe({
      next: (portal) => {
        this.portal.set(portal);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
        this.error.set(true);
      },
    });
  }

  askAssignment(adventurer: PortalAdventurerChoice): void {
    this.assignmentConflict.set(false);
    this.confirmingAdventurer.set(adventurer);
  }

  cancelAssignment(): void {
    this.confirmingAdventurer.set(null);
  }

  confirmAssignment(): void {
    const adventurer = this.confirmingAdventurer();
    if (!adventurer) {
      return;
    }
    this.api.chooseAdventurer(adventurer.id).subscribe({
      next: (portal) => {
        this.portal.set(portal);
        this.confirmingAdventurer.set(null);
        this.assignmentConflict.set(false);
      },
      error: () => {
        this.assignmentConflict.set(true);
        this.confirmingAdventurer.set(null);
        this.load(true);
      },
    });
  }

  chooseGuest(): void {
    this.api.chooseGuest().subscribe({
      next: (portal) => {
        this.portal.set(portal);
        this.assignmentConflict.set(false);
      },
      error: () => this.load(true),
    });
  }
}
