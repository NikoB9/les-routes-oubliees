import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, tap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../offline/public-content-cache.service';
import { PublicSiteSettings } from './site-settings.models';

@Injectable({ providedIn: 'root' })
export class SiteSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PublicContentCacheService);

  getPublicSettings() {
    return this.http.get<PublicSiteSettings>('/api/public/settings').pipe(
      tap((settings) => this.writeSettingsToCache(settings)),
      catchError((error: unknown) => {
        if (!this.cache.shouldUseOfflineFallback(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readSettings()).pipe(
          switchMap((settings) => (settings ? of(settings) : throwError(() => error))),
        );
      }),
    );
  }

  private writeSettingsToCache(settings: PublicSiteSettings): void {
    void this.cache.writeSettings(settings).catch(() => {
      // Public caching is opportunistic and must not break online rendering.
    });
  }
}
