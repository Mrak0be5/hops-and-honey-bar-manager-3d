import { expect, test } from '@playwright/test';

test('opens the bar and exposes the full upgrade surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Хмель/ })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await expect(page.getByText('БАРМЕН', { exact: true })).toBeVisible();
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

test('fits the welcome card in a landscape phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const card = page.locator('.welcome-card');
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
});
