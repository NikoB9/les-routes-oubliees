import { adminAuthGuard } from '../../core/guards/admin-auth.guard';
import { adminRoutes } from './admin.routes';

describe('adminRoutes', () => {
  it('declares every admin section explicitly below the protected layout', () => {
    expect(adminRoutes.map((route) => route.path)).toEqual(['forbidden', '']);
    const protectedRoute = adminRoutes[1];
    expect(protectedRoute.canActivate).toContain(adminAuthGuard);
    expect(protectedRoute.children?.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'home',
      'group',
      'adventurers',
      'map',
      'notebook',
      'media',
      'administrators',
      'audit',
      'settings',
      'radar',
      'portal',
      '**',
    ]);
  });

  it('lazy loads the layout and every concrete page', () => {
    const protectedRoute = adminRoutes[1];
    expect(protectedRoute.loadComponent).toBeTypeOf('function');
    for (const route of protectedRoute.children?.filter((child) => child.path && child.path !== '**') ?? []) {
      expect(route.loadComponent).toBeTypeOf('function');
      expect(route.title).toBeTruthy();
    }
  });
});
