import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

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

const company = {
  id: 'company-e2e',
  name: 'Compagnie E2E',
  emblemPath: null,
  imageAlt: null,
  shortDescription: 'Compagnie de test',
  longDescriptionMarkdown: 'Présentation de test',
  active: true,
  createdAt: '2026-09-14T10:00:00Z',
  updatedAt: '2026-09-14T10:00:00Z',
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const responses: Readonly<Record<string, unknown>> = {
      '/api/admin/me': { authenticated: true, email: 'admin@example.test' },
      '/api/admin/group': company,
      '/api/admin/adventurers': [],
      '/api/admin/map-views': [],
      '/api/admin/map-markers': [],
      '/api/admin/quest-tabs': [],
      '/api/admin/media': [],
      '/api/admin/allowed-emails': [],
      '/api/admin/audit-logs': [
        {
          id: 'audit-e2e',
          actorEmail: 'admin@example.test',
          action: 'QUEST_PUBLISHED',
          entityType: 'QUEST',
          entityId: 'QUEST_1',
          summary: 'Quête publiée',
          createdAt: '2026-09-14T10:00:00Z',
        },
      ],
      '/api/admin/settings': siteSettings,
      '/api/admin/radar/settings': { treasureVisible: false, treasure: null },
      '/api/admin/radar/points': [],
      '/api/admin/portal-identities': [],
    };

    if (!(pathname in responses)) {
      await route.fulfill({ status: 404, contentType: 'application/problem+json', body: '{}' });
      return;
    }
    await fulfillJson(route, responses[pathname]);
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

  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });

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

  await page.goto('/admin/home', { waitUntil: 'domcontentloaded' });
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

const remainingAdminPages = [
  ['/admin/group', 'Compagnie'],
  ['/admin/adventurers', 'Aventuriers'],
  ['/admin/map', 'Carte'],
  ['/admin/notebook', 'Gestion des quêtes'],
  ['/admin/media', 'Médiathèque'],
  ['/admin/administrators', 'Administrateurs autorisés'],
  ['/admin/audit', "Journal d'audit"],
  ['/admin/settings', 'Paramètres du site'],
  ['/admin/radar', 'Radar'],
  ['/admin/portal', 'Identités du portail'],
] as const;

for (const [path, heading] of remainingAdminPages) {
  test(`@a11y ${path} has no serious accessibility violations once loaded`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

    if (path === '/admin/settings') {
      await expect(page.getByRole('textbox', { name: 'Fuseau horaire (obligatoire)' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'État du site' })).toBeVisible();
    }
    if (path === '/admin/audit') {
      await expect(page.locator('.audit-list strong')).toHaveText('Quête publiée');
      await expect(page.locator('.audit-list small')).toContainText('Quête QUEST_1');
    }

    expect(await seriousAccessibilityViolations(page)).toEqual([]);
  });
}
