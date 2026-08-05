import { adminRoutes } from './admin.routes';

describe('adminRoutes', () => {
  it('registers the expected protected admin module paths', () => {
    const paths = adminRoutes.map((route) => route.path);

    expect(paths).toEqual(['forbidden', '']);
    expect(adminRoutes[1].children?.map((route) => route.path)).toEqual(['', ':section']);
  });

  it('protects every admin module route except the forbidden page', () => {
    const moduleRoutes = adminRoutes.filter((route) => route.path !== 'forbidden');

    expect(moduleRoutes.every((route) => route.canActivate?.length === 1)).toBe(true);
  });
});
