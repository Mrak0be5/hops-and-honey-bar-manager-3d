import { expect, test } from '@playwright/test';

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

test('mobile HUD has no overlap and touch targets >= 44', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click({ timeout: 20_000 });

  const currency = await page.locator('.currency-strip').boundingBox();
  const settings = await page.locator('.settings-button').boundingBox();
  const meta = await page.locator('.meta-rail').boundingBox();
  const chip = await page.locator('.live-chip').boundingBox();
  const staffFace = await page.locator('.fab-staff .round-fab-face').boundingBox();
  const manageFace = await page.locator('.fab-manage .round-fab-face').boundingBox();
  const dock = await page.locator('.bottom-dock').boundingBox();

  expect(currency).not.toBeNull();
  expect(settings).not.toBeNull();
  expect(meta).not.toBeNull();
  expect(chip).not.toBeNull();
  expect(staffFace).not.toBeNull();
  expect(manageFace).not.toBeNull();
  expect(dock).not.toBeNull();

  expect(settings!.width).toBeGreaterThanOrEqual(44);
  expect(settings!.height).toBeGreaterThanOrEqual(44);
  expect(staffFace!.width).toBeGreaterThanOrEqual(44);
  expect(staffFace!.height).toBeGreaterThanOrEqual(44);
  expect(manageFace!.width).toBeGreaterThanOrEqual(44);
  expect(manageFace!.height).toBeGreaterThanOrEqual(44);

  expect(overlaps(currency!, settings!)).toBe(false);
  expect(overlaps(currency!, meta!)).toBe(false);
  expect(overlaps(chip!, staffFace!)).toBe(false);
  expect(overlaps(chip!, manageFace!)).toBe(false);
  expect(overlaps(staffFace!, manageFace!)).toBe(false);

  expect(currency!.y).toBeGreaterThanOrEqual(0);
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(852 + 1);
  expect(chip!.x + chip!.width).toBeLessThanOrEqual(staffFace!.x + 1);

  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('button', { name: /Звук/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Экран 9:16/i })).toBeVisible();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.locator('.settings-popover')).toHaveCount(0);

  await page.getByRole('button', { name: 'Улучшения', exact: true }).click();
  await expect(page.locator('#upgrade-panel')).toHaveClass(/is-open/);
  await expect(page.getByRole('button', { name: 'Улучшения', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть управление' }).click();
});
