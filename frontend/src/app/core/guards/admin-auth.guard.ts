import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AdminAuthService } from '../auth/admin-auth.service';

export const adminAuthGuard: CanActivateFn = () => {
  const authService = inject(AdminAuthService);
  const router = inject(Router);

  return authService.currentSession().pipe(
    map((session) => (session.authenticated ? true : router.createUrlTree(['/admin/forbidden']))),
    catchError(() => of(router.createUrlTree(['/admin/forbidden'], {
      queryParams: { error: 'access_denied' },
    }))),
  );
};
