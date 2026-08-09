import { expect, test, type Locator } from '@playwright/test';

async function waitForOwnAnimations(locator: Locator) {
  await locator.evaluate((element) => Promise.all(
    element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
  ));
}

test('opens the bar and exposes the full upgrade surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Хмель/ })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await expect(page.locator('.bottom-status')).toBeVisible();
  const panel = page.locator('.upgrade-panel');
  if (!(await panel.evaluate((element) => element.classList.contains('is-open')))) {
    await page.getByRole('button', { name: 'Улучшения бара' }).click();
  }
  await expect(panel).toHaveClass(/is-open/);
  await expect(page.getByRole('heading', { name: 'Улучшения бара' })).toBeVisible();
  await expect(page.locator('.upgrade-card')).toHaveCount(6);
});

test('fits the mobile viewport without horizontal document overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
});

test('keeps hidden controls out of the welcome-screen tab order', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  const startButton = page.getByRole('button', { name: 'Открыть бар' });
  await page.keyboard.press('Tab');
  await expect(startButton).toBeFocused();
});

test('keeps sound available and collapsed upgrades inert on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await expect(page.getByRole('button', { name: /звук/i })).toBeVisible();
  await expect(page.locator('.upgrade-panel')).toHaveAttribute('inert', '');
});

test('uses a touch-friendly portrait dock and contained upgrade sheet', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-chromium', 'Portrait dock is covered by the mobile projects');
  test.setTimeout(180_000);
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Открыть бар' }).click();

    const dock = page.locator('.control-strip');
    const dockBounds = await dock.boundingBox();
    expect(dockBounds).not.toBeNull();
    expect(dockBounds!.y + dockBounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(dockBounds!.height).toBeGreaterThanOrEqual(70);

    const buttons = dock.locator('.icon-button');
    await expect(buttons).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      const bounds = await buttons.nth(index).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }

    const statusBounds = await page.locator('.bottom-status').boundingBox();
    expect(statusBounds).not.toBeNull();
    expect(statusBounds!.y + statusBounds!.height).toBeLessThanOrEqual(dockBounds!.y + 1);

    const upgradeButton = page.getByRole('button', { name: 'Улучшения бара' });
    await expect(upgradeButton).toHaveAttribute('aria-expanded', 'false');
    await upgradeButton.click();
    await expect(upgradeButton).toHaveAttribute('aria-expanded', 'true');
    await expect(upgradeButton.locator('img')).toHaveAttribute('src', /upgrade-arrow\.webp$/);

    const panel = page.locator('.upgrade-panel');
    await expect(panel).toHaveClass(/is-open/);
    await waitForOwnAnimations(panel);
    const panelBounds = await panel.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(dockBounds!.y + 1);

    await panel.locator('.upgrade-card').last().scrollIntoViewIfNeeded();
    await expect(panel.locator('.upgrade-card').last()).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть улучшения' }).click();
    await expect(upgradeButton).toHaveAttribute('aria-expanded', 'false');
  }
});

test('fits the welcome card in a landscape phone viewport', async ({ page }) => {
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const card = page.locator('.welcome-card');
    await expect(card).toBeVisible();
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);

    if (viewport.width <= 700) {
      await expect(page.locator('.viewport-mode-toggle')).toBeHidden();
    }
  }
});
