import { expect, test } from '@playwright/test';

const imageUrl = '/assets/maps/map-hidden.png';

function markdownImage(size: 'small' | 'medium' | 'large' | 'full') {
  return `<figure class="markdown-image markdown-image--${size}"><img src="${imageUrl}" alt="Carte ${size}"><figcaption>${size}</figcaption></figure>`;
}

test('quest Markdown images respect their selected size without overflowing', async ({ page }) => {
  await page.route('**/api/portal/me', async (route) => {
    await route.fulfill({
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

  await page.route('**/api/public/notebook', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: '50000000-0000-0000-0000-000000000001',
          code: 'QUEST_1',
          title: 'Quête révélée',
          summary: 'Les tailles du carnet',
          displayOrder: 1,
        },
      ]),
    });
  });

  await page.route('**/api/public/notebook/QUEST_1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '50000000-0000-0000-0000-000000000001',
        code: 'QUEST_1',
        title: 'Quête révélée',
        summary: 'Les tailles du carnet',
        displayOrder: 1,
        importantEventsHtml: markdownImage('small'),
        discoveredCluesHtml: markdownImage('medium'),
        completedTrialsHtml: markdownImage('large'),
        extraContentHtml: markdownImage('full'),
      }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/notebook/QUEST_1');

  const expectedRatios = { small: 0.35, medium: 0.6, large: 0.8, full: 1 };
  for (const [size, ratio] of Object.entries(expectedRatios)) {
    const figure = page.locator(`.markdown-image--${size}`);
    const content = figure.locator('xpath=..');
    const image = figure.locator('img');

    await expect(figure).toBeVisible();
    const [figureBox, contentBox, imageBox] = await Promise.all([
      figure.boundingBox(),
      content.boundingBox(),
      image.boundingBox(),
    ]);

    expect(figureBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(figureBox!.width / contentBox!.width).toBeCloseTo(ratio, 1);
    expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(contentBox!.x + contentBox!.width + 1);
  }

  await page.setViewportSize({ width: 390, height: 844 });

  for (const size of Object.keys(expectedRatios)) {
    const figure = page.locator(`.markdown-image--${size}`);
    const content = figure.locator('xpath=..');
    const [figureBox, contentBox] = await Promise.all([figure.boundingBox(), content.boundingBox()]);

    expect(figureBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(figureBox!.width / contentBox!.width).toBeCloseTo(1, 1);
  }
});
