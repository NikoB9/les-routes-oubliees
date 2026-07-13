import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, tap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicHomeResponse } from './home-api.models';

@Injectable({ providedIn: 'root' })
export class HomeApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PublicContentCacheService);

  getHome() {
    return this.http.get<PublicHomeResponse>('/api/public/home').pipe(
      tap((home) => this.writeHomeToCache(home)),
      catchError((error: unknown) => {
        if (!this.cache.shouldUseOfflineFallback(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readHome()).pipe(
          switchMap((home) => (home ? of(home) : throwError(() => error))),
        );
      }),
    );
  }

  private writeHomeToCache(home: PublicHomeResponse): void {
    void this.cache.writeHome(home).catch(() => {
      // Public caching is opportunistic and must not break online rendering.
    });
  }
}
