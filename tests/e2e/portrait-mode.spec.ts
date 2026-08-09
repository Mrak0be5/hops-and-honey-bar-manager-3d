import { expect, test, type Locator } from '@playwright/test';

type Bounds = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

function expectInside(inner: Bounds, outer: Bounds, tolerance = 1) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + tolerance);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + tolerance);
}

async function waitForPanelTransition(panel: Locator) {
  await panel.evaluate((element) => Promise.all(
    element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
  ));
}

test('switches the live game into a contained 9:16 iPhone view without resetting play', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The in-page preview toggle is a desktop web-build control');
  test.setTimeout(120_000);

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await page.getByRole('button', { name: /Скорость игры x1/ }).click();
  await expect(page.getByRole('button', { name: /Скорость игры x2/ })).toBeVisible();

  const toggle = page.getByRole('button', { name: 'Включить вид 9:16' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  expect(await toggle.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await toggle.click();

  const activeToggle = page.getByRole('button', { name: 'Вернуть адаптивный вид' });
  await expect(activeToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.app-stage')).toHaveClass(/is-portrait-preview/);
  await expect(page.locator('.game-shell')).toHaveAttribute('data-viewport-mode', 'portrait');
  await expect(page.getByRole('button', { name: /Скорость игры x2/ })).toBeVisible();

  const shellBounds = await page.locator('.game-shell').boundingBox();
  expect(shellBounds).not.toBeNull();
  expect(Math.abs(shellBounds!.width / shellBounds!.height - 9 / 16)).toBeLessThan(0.006);
  expect(shellBounds!.width).toBeLessThan(600);

  for (const selector of ['.presentation-canvas', '.top-hud', '.control-strip', '.bottom-status']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds, `${selector} must have layout bounds`).not.toBeNull();
    expectInside(bounds!, shellBounds!);
  }

  const dockBounds = await page.locator('.control-strip').boundingBox();
  const statusBounds = await page.locator('.bottom-status').boundingBox();
  expect(statusBounds!.y + statusBounds!.height).toBeLessThanOrEqual(dockBounds!.y + 1);

  await page.getByRole('button', { name: 'Улучшения бара' }).click();
  const panel = page.locator('.upgrade-panel');
  await expect(panel).toHaveClass(/is-open/);
  await waitForPanelTransition(panel);
  const panelBounds = await panel.boundingBox();
  expect(panelBounds).not.toBeNull();
  expectInside(panelBounds!, shellBounds!);
  await panel.locator('.upgrade-card').last().scrollIntoViewIfNeeded();
  await expect(panel.locator('.upgrade-card').last()).toBeVisible();

  await page.waitForTimeout(400);
  await page.screenshot({
    path: `output/playwright/portrait-preview-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await activeToggle.click();
  const adaptiveToggle = page.locator('.viewport-mode-toggle');
  await expect(adaptiveToggle).toHaveAttribute('aria-label', 'Включить вид 9:16');
  await expect(adaptiveToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.game-shell')).toHaveAttribute('data-viewport-mode', 'adaptive');
  await expect(page.getByRole('button', { name: /Скорость игры x2/ })).toBeVisible();
  await expect(adaptiveToggle).toBeHidden();
  await page.getByRole('button', { name: 'Закрыть улучшения' }).click();
  await expect(page.getByRole('button', { name: 'Включить вид 9:16' })).toBeVisible();
});

test('keeps the HUD and upgrade sheet inside an exact 9:16 iPhone viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-chromium', 'Exact phone viewport is covered by touch/mobile projects');
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();

  const shellBounds = await page.locator('.game-shell').boundingBox();
  const topBounds = await page.locator('.top-hud').boundingBox();
  const dockBounds = await page.locator('.control-strip').boundingBox();
  const statusBounds = await page.locator('.bottom-status').boundingBox();
  expect(shellBounds).not.toBeNull();
  expect(topBounds).not.toBeNull();
  expect(dockBounds).not.toBeNull();
  expect(statusBounds).not.toBeNull();
  expectInside(topBounds!, shellBounds!);
  expectInside(dockBounds!, shellBounds!);
  expectInside(statusBounds!, shellBounds!);
  expect(statusBounds!.y + statusBounds!.height).toBeLessThanOrEqual(dockBounds!.y + 1);

  for (const button of await page.locator('.control-strip .icon-button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }

  const roomPillOverflow = await page.locator('.room-pill').evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(roomPillOverflow.scroll).toBeLessThanOrEqual(roomPillOverflow.client);

  await page.getByRole('button', { name: 'Улучшения бара' }).click();
  const panel = page.locator('.upgrade-panel');
  await expect(panel).toHaveClass(/is-open/);
  await waitForPanelTransition(panel);
  const panelBounds = await panel.boundingBox();
  expect(panelBounds).not.toBeNull();
  expectInside(panelBounds!, shellBounds!);
  await panel.locator('.upgrade-card').last().scrollIntoViewIfNeeded();
  await expect(panel.locator('.upgrade-card').last()).toBeVisible();

  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client);

  await page.waitForTimeout(400);
  await page.screenshot({
    path: `output/playwright/iphone-9x16-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
