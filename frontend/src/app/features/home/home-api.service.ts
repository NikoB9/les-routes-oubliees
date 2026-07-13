import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError } from 'rxjs';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicHomeResponse } from './home-api.models';

@Injectable({ providedIn: 'root' })
export class HomeApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PublicContentCacheService);

  getHome() {
    return this.http.get<PublicHomeResponse>('/api/public/home').pipe(
      catchError((error: unknown) => {
        if (!this.isNetworkError(error)) {
          return throwError(() => error);
        }

        return from(this.cache.readHome()).pipe(
          switchMap((home) => (home ? of(home) : throwError(() => error))),
        );
      }),
    );
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }
}
