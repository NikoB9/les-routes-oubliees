import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function seriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
}

const homeMessage = {
  id: 'home-message-e2e',
  title: 'Parchemin E2E',
  contentMarkdown: 'Message de départ',
  importance: 'INFORMATION',
  status: 'PUBLISHED',
  active: false,
  countdownEnabled: false,
  endsAt: null,
  expiredMessage: null,
  lastModifiedBy: 'admin@example.test',
  createdAt: '2026-09-14T10:00:00Z',
  updatedAt: '2026-09-14T10:00:00Z',
};

const siteSettings = {
  id: 'settings-e2e',
  siteName: 'Les Routes Oubliées',
  subtitle: null,
  logoPath: null,
  timezone: 'Europe/Paris',
  status: 'ONLINE',
  maintenanceMessage: null,
  accessibilityInformationMarkdown: '',
  updatedBy: 'admin@example.test',
  createdAt: '2026-09-14T10:00:00Z',
  updatedAt: '2026-09-14T10:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, email: 'admin@example.test' }),
    });
  });
});

test('@a11y admin dashboard is lazy-loaded and has no serious accessibility violations', async ({ page }) => {
  await page.route('**/api/admin/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activeHomeMessageTitle: 'Parchemin E2E',
        activeMapVisionName: 'Carte E2E',
        activeCompanyName: 'Compagnie E2E',
        visibleAdventurerCount: 5,
        visibleQuestCount: 2,
        mediaCount: 1,
        activeAdministratorCount: 1,
        latestAuditLogs: [],
      }),
    });
  });

  await page.goto('/admin/dashboard');

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  expect(await seriousAccessibilityViolations(page)).toEqual([]);
});

test('@a11y home editor exposes validation, media insertion and deletion confirmation', async ({
  page,
}) => {
  let deleteRequests = 0;
  await page.route('**/api/admin/home/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([homeMessage]),
    });
  });
  await page.route('**/api/admin/settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(siteSettings),
    });
  });
  await page.route('**/api/admin/media', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'media-e2e',
          originalFilename: 'carte.webp',
          url: '/assets/maps/map-hidden.png',
          mimeType: 'image/webp',
          sizeBytes: 1024,
          width: 800,
          height: 600,
          altText: 'Carte secrète',
          createdAt: '2026-09-14T10:00:00Z',
          createdBy: 'admin@example.test',
        },
      ]),
    });
  });
  await page.route('**/api/admin/home/messages/home-message-e2e', async (route) => {
    if (route.request().method() === 'DELETE') {
      deleteRequests += 1;
    }
    await route.fulfill({ status: 204 });
  });

  await page.goto('/admin/home');
  await expect(page.getByRole('heading', { level: 1, name: "Parchemins d'accueil" })).toBeVisible();
  expect(await seriousAccessibilityViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Image', exact: true }).click();
  const imageDialog = page.getByRole('dialog', { name: 'Insérer une image' });
  await expect(imageDialog).toBeVisible();
  expect(await seriousAccessibilityViolations(page)).toEqual([]);
  await imageDialog.getByRole('button', { name: /carte\.webp/i }).click();
  await imageDialog.getByRole('button', { name: "Insérer l’image" }).click();
  await expect(page.locator('#home-content')).toHaveValue(/!\[Carte secrète\]/);

  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const errorSummary = page.locator('#home-error-summary');
  await expect(errorSummary).toBeFocused();
  await expect(page.locator('#home-title')).toHaveAttribute('aria-invalid', 'true');
  expect(await seriousAccessibilityViolations(page)).toEqual([]);

  await page.getByRole('button', { name: /Parchemin E2E/ }).first().click();
  const deleteButton = page.getByRole('button', { name: 'Supprimer Parchemin E2E' });
  await deleteButton.click();
  const deleteDialog = page.getByRole('dialog', { name: 'Supprimer ce parchemin ?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(deleteDialog).not.toBeVisible();
  await expect(deleteButton).toBeFocused();
  expect(deleteRequests).toBe(0);
});
