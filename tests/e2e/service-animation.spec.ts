import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('plays a seated guest through drinking and payment', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name === 'mobile-chromium', 'The full timed walkthrough is captured once on desktop; mobile rendering has its own visual and smoke coverage.');
  mkdirSync('output/playwright', { recursive: true });

  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await page.getByRole('button', { name: /Скорость игры x1/ }).click();

  const stage = (label: string) => page.locator(`.world-emoji[aria-label="${label}"]`).first();
  await expect(stage('Ждёт бармена')).toBeVisible({ timeout: 25_000 });
  await expect(stage('Ждёт напиток')).toBeVisible({ timeout: 35_000 });

  await expect(stage('Пьёт заказ')).toBeVisible({ timeout: 45_000 });

  const canvas = page.locator('canvas.presentation-canvas');
  const rawCanvas = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL('image/png'),
  );
  writeFileSync(
    `output/playwright/seated-drinking-${testInfo.project.name}.png`,
    Buffer.from(rawCanvas.slice(rawCanvas.indexOf(',') + 1), 'base64'),
  );

  await expect(page.locator('[aria-label="Обслужено гостей: 1"]')).toBeVisible({ timeout: 55_000 });
  await expect(page.locator('.pause-scrim')).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});
