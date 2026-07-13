import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../offline/public-content-cache.service';
import { PublicSiteSettings } from './site-settings.models';

@Injectable({ providedIn: 'root' })
export class SiteSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PublicContentCacheService);

  getPublicSettings() {
    return this.http.get<PublicSiteSettings>('/api/public/settings').pipe(
      catchError((error: unknown) => {
        if (!this.isNetworkError(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readSettings()).pipe(
          switchMap((settings) => (settings ? of(settings) : throwError(() => error))),
        );
      }),
    );
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }
}
