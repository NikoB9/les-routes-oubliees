import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicMapResponse } from './map-api.models';

@Injectable({ providedIn: 'root' })
export class MapApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PublicContentCacheService);

  getMap() {
    return this.http.get<PublicMapResponse>('/api/public/map').pipe(
      catchError((error: unknown) => {
        if (!this.isNetworkError(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readMap()).pipe(
          switchMap((map) => (map ? of(map) : throwError(() => error))),
        );
      }),
    );
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }
}
