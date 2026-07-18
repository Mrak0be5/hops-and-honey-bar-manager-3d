import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('plays a complete seated guest service cycle', async ({ page }, testInfo) => {
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

  // Pause in the same browser task that first observes the drinking state.
  // A separate round trip can miss this short phase on a busy WebGL worker.
  await page.waitForFunction(() => {
    const drinking = document.querySelector('.world-emoji[aria-label="Пьёт заказ"]');
    const pause = document.querySelector<HTMLButtonElement>('button[aria-label="Пауза"]');
    if (!drinking || !pause) return false;
    pause.click();
    return true;
  }, undefined, { timeout: 45_000 });
  await page.waitForTimeout(1_000);
  await expect(stage('Пьёт заказ')).toBeVisible();

  const canvas = page.locator('canvas');
  const rawCanvas = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL('image/png'),
  );
  writeFileSync(
    `output/playwright/seated-drinking-${testInfo.project.name}.png`,
    Buffer.from(rawCanvas.slice(rawCanvas.indexOf(',') + 1), 'base64'),
  );

  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(stage('Хочет заплатить')).toBeVisible({ timeout: 35_000 });
  await expect(stage('Уходит счастливым')).toBeVisible({ timeout: 35_000 });
  expect(runtimeErrors).toEqual([]);
});
