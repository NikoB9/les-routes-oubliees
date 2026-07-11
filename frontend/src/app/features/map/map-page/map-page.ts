import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { parseSafeMarkdown } from '../../../shared/utilities/safe-markdown';
import { MapApiService } from '../map-api.service';
import { PublicMapResponse } from '../map-api.models';

@Component({
  selector: 'app-map-page',
  imports: [RouterLink],
  templateUrl: './map-page.html',
  styleUrl: './map-page.css',
})
export class MapPage {
  private readonly api = inject(MapApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly map = signal<PublicMapResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly vision = computed(() => this.map()?.vision ?? null);
  protected readonly markers = computed(() => this.map()?.markers ?? []);
  protected readonly descriptionBlocks = computed(() =>
    parseSafeMarkdown(this.vision()?.descriptionMarkdown),
  );

  constructor() {
    this.api
      .getMap()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (map) => {
          this.map.set(map);
          this.loading.set(false);
          this.loadError.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

}
