import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';

const REQUESTED_WITH = 'X-Requested-With';
const SAME_ORIGIN_API = '/api/';
const HOME_ASSISTANT_INTEGRATION = '/api/integrations/home-assistant/radar/treasure-position';

export const cloudflareAccessInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(CloudflareAccessSessionService);
  const humanApiRequest = isSameOriginApiRequest(request.url) && !request.url.startsWith(HOME_ASSISTANT_INTEGRATION);
  const apiRequest = humanApiRequest
    ? request.clone({
        setHeaders: {
          [REQUESTED_WITH]: 'XMLHttpRequest',
        },
      })
    : request;

  return next(apiRequest).pipe(
    tap(() => {
      if (humanApiRequest) {
        session.clearPendingReauthentication();
      }
    }),
    catchError((error: unknown) => {
      if (humanApiRequest && error instanceof HttpErrorResponse && error.status === 401) {
        session.reauthenticate();
      }
      return throwError(() => error);
    }),
  );
};

function isSameOriginApiRequest(url: string) {
  if (url.startsWith(SAME_ORIGIN_API)) {
    return true;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith(SAME_ORIGIN_API);
  }
  catch {
    return false;
  }
}
