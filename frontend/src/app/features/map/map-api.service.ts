import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, tap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicMapResponse } from './map-api.models';

@Injectable({ providedIn: 'root' })
export class MapApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PublicContentCacheService);

  getMap() {
    return this.http.get<PublicMapResponse>('/api/public/map').pipe(
      tap((map) => this.writeMapToCache(map)),
      catchError((error: unknown) => {
        if (!this.cache.shouldUseOfflineFallback(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readMap()).pipe(
          switchMap((map) => (map ? of(map) : throwError(() => error))),
        );
      }),
    );
  }

  private writeMapToCache(map: PublicMapResponse): void {
    void this.cache.writeMap(map).catch(() => {
      // Public caching is opportunistic and must not break online rendering.
    });
  }
}
