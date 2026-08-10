import { expect, test } from '@playwright/test';

type Bounds = { x: number; y: number; width: number; height: number };

function expectInside(inner: Bounds, outer: Bounds) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

test('puts speed and settings in the top corners and removes pause controls', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();

  const shell = page.locator('.game-shell');
  const speed = page.getByRole('button', { name: 'Скорость игры x1' });
  const settings = page.getByRole('button', { name: 'Настройки' });
  await expect(speed).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(page.getByRole('button', { name: /Пауза|Продолжить/ })).toHaveCount(0);
  await expect(page.locator('.control-strip .speed-button')).toHaveCount(0);
  await expect(page.locator('.control-strip .icon-button')).toHaveCount(1);

  const shellBounds = await shell.boundingBox();
  const speedBounds = await speed.boundingBox();
  const settingsBounds = await settings.boundingBox();
  expect(shellBounds).not.toBeNull();
  expect(speedBounds).not.toBeNull();
  expect(settingsBounds).not.toBeNull();
  expectInside(speedBounds!, shellBounds!);
  expectInside(settingsBounds!, shellBounds!);
  expect(speedBounds!.width).toBeGreaterThanOrEqual(44);
  expect(speedBounds!.height).toBeGreaterThanOrEqual(44);
  expect(settingsBounds!.width).toBeGreaterThanOrEqual(44);
  expect(settingsBounds!.height).toBeGreaterThanOrEqual(44);
  expect(speedBounds!.x).toBeLessThan(shellBounds!.x + shellBounds!.width / 2);
  expect(settingsBounds!.x).toBeGreaterThan(shellBounds!.x + shellBounds!.width / 2);

  await speed.click();
  await expect(page.getByRole('button', { name: 'Скорость игры x2' })).toBeVisible();
  await settings.click();

  const dialog = page.getByRole('dialog', { name: 'Настройки' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'Сбросить прогресс' })).toBeVisible();
  await expect(page.locator('.upgrade-panel')).not.toBeVisible();

  const sound = page.getByRole('button', { name: 'Выключить звук' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(page.getByRole('button', { name: 'Включить звук' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Включить звук' }).click();
  await expect(page.getByRole('button', { name: 'Выключить звук' })).toHaveAttribute('aria-pressed', 'true');

  const before = await page.locator('.day-track i').evaluate((element) => parseFloat((element as HTMLElement).style.width));
  await page.waitForTimeout(900);
  const after = await page.locator('.day-track i').evaluate((element) => parseFloat((element as HTMLElement).style.width));
  expect(after).toBeGreaterThan(before);

  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds).not.toBeNull();
  expectInside(dialogBounds!, shellBounds!);
  if (testInfo.project.name === 'iphone-9x16-webkit') {
    await page.screenshot({ path: `output/playwright/settings-${testInfo.project.name}.png`, fullPage: false });
  }

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(settings).toBeFocused();
});

test('keeps reset behind confirmation and restores a fresh x1 game', async ({ page }) => {
  test.setTimeout(60_000);
  let browserDialogOpened = false;
  page.on('dialog', async (dialog) => {
    browserDialogOpened = true;
    await dialog.dismiss();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await page.getByRole('button', { name: 'Скорость игры x1' }).click();
  await page.getByRole('button', { name: 'Настройки' }).click();

  const reset = page.getByRole('button', { name: 'Сбросить прогресс' });
  await reset.click();
  await expect(page.getByRole('heading', { name: 'Сбросить весь прогресс?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отмена' })).toBeFocused();
  expect(browserDialogOpened).toBe(false);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Настройки' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Сбросить весь прогресс?' })).toHaveCount(0);
  await expect(reset).toBeFocused();
  await expect(page.locator('.brand-speed-button')).toHaveAttribute('aria-label', 'Скорость игры x2');

  await reset.click();
  await page.getByRole('button', { name: 'Да, сбросить' }).click();
  await expect(page.getByRole('button', { name: 'Открыть бар' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Настройки' })).not.toBeVisible();
  expect(browserDialogOpened).toBe(false);

  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await expect(page.getByRole('button', { name: 'Скорость игры x1' })).toBeVisible();
});
