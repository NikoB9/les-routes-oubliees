import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAuthService } from '../auth/admin-auth.service';
import { adminAuthGuard } from './admin-auth.guard';

describe('adminAuthGuard', () => {
  let currentSession: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    currentSession = vi.fn(() => of({ authenticated: true, email: 'admin@example.invalid' }));

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AdminAuthService, useValue: { currentSession } }],
    });

    router = TestBed.inject(Router);
  });

  it('lets an authenticated administrator through', async () => {
    await expect(runGuard()).resolves.toBe(true);
  });

  it('redirects an unauthenticated visitor to the forbidden page', async () => {
    currentSession.mockReturnValue(of({ authenticated: false, email: null }));

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/admin/forbidden');
  });

  /**
   * Un refus serveur ne doit jamais laisser la route admin s'ouvrir : l'erreur est traduite
   * en redirection, avec un motif exploitable par la page.
   */
  it('redirects with a reason when the session cannot be read', async () => {
    currentSession.mockReturnValue(throwError(() => new Error('forbidden')));

    const result = await runGuard();

    expect(router.serializeUrl(result as UrlTree)).toBe('/admin/forbidden?error=access_denied');
  });

  async function runGuard(): Promise<unknown> {
    const result = TestBed.runInInjectionContext(() =>
      adminAuthGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    return isObservable(result) ? firstValueFrom(result) : result;
  }
});
