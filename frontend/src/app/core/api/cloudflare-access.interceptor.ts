import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';

const REQUESTED_WITH = 'X-Requested-With';
const SAME_ORIGIN_API = '/api/';
const HOME_ASSISTANT_INTEGRATION = '/api/integrations/home-assistant/radar/treasure-position';

/** Marqueur posé par le backend sur ses propres refus d'authentification. */
const APPLICATION_AUTH_ERROR_HEADER = 'X-LRO-Auth-Error';
const APPLICATION_AUTH_ERROR_VALUE = 'application';
const APPLICATION_AUTH_ERROR_CODE = 'application-unauthenticated';

/**
 * Signale les appels API humains comme requêtes AJAX.
 *
 * Cloudflare documente que cet en-tête fait répondre `401` au lieu d'une redirection
 * lorsque la session Access a expiré :
 * https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/#ajax
 *
 * Un `401` n'est donc traité comme une expiration Access que s'il ne porte pas le
 * marqueur applicatif : les refus émis par le backend lui-même ne doivent jamais
 * faire croire à une session perdue.
 */
export const cloudflareAccessInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(CloudflareAccessSessionService);
  const humanApiRequest =
    isSameOriginApiRequest(request.url) && !request.url.startsWith(HOME_ASSISTANT_INTEGRATION);
  const apiRequest = humanApiRequest
    ? request.clone({
        setHeaders: {
          [REQUESTED_WITH]: 'XMLHttpRequest',
        },
      })
    : request;

  return next(apiRequest).pipe(
    catchError((error: unknown) => {
      if (
        humanApiRequest &&
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isApplicationAuthError(error)
      ) {
        session.noteExpiredSession();
      }
      return throwError(() => error);
    }),
  );
};

function isApplicationAuthError(error: HttpErrorResponse): boolean {
  if (error.headers.get(APPLICATION_AUTH_ERROR_HEADER) === APPLICATION_AUTH_ERROR_VALUE) {
    return true;
  }
  const body: unknown = error.error;
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { code?: unknown }).code === APPLICATION_AUTH_ERROR_CODE
  );
}

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
