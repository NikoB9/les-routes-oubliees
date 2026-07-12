import { adminRoutes } from './admin.routes';

describe('adminRoutes', () => {
  it('registers the expected protected admin module paths', () => {
    const paths = adminRoutes.map((route) => route.path);

    expect(paths).toEqual([
      'login',
      '',
      'home',
      'group',
      'adventurers',
      'map',
      'notebook',
      'media',
      'administrators',
      'audit',
      'settings',
    ]);
  });

  it('protects every admin module route except the login page', () => {
    const moduleRoutes = adminRoutes.filter((route) => route.path !== 'login');

    expect(moduleRoutes.every((route) => route.canActivate?.length === 1)).toBe(true);
  });
});
