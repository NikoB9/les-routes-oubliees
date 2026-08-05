import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicRoutes = ['/', '/map', '/notebook'];

for (const route of publicRoutes) {
  test(`@a11y ${route} has no serious accessibility violations`, async ({ page }) => {
    await page.route('**/api/portal/me', async (request) => {
      await request.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          identity: {
            id: 'identity-e2e',
            accessMode: 'ADVENTURER',
            adventurerId: 'adventurer-e2e',
            displayName: 'Aurelune',
            avatarPath: null,
            selectedAt: '2026-08-05T12:00:00Z',
          },
          availableAdventurers: [],
          guestAvailable: false,
          canAccessAdmin: false,
        }),
      });
    });

    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const seriousViolations = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );

    expect(seriousViolations).toEqual([]);
  });
}
