import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('captures a representative running bar scene', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  mkdirSync('output/playwright', { recursive: true });

  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();

  const panel = page.locator('.upgrade-panel');
  if (await panel.evaluate((element) => element.classList.contains('is-open'))) {
    await page.getByRole('button', { name: 'Улучшения бара' }).click();
  }

  await page.waitForTimeout(testInfo.project.name === 'desktop-chromium' ? 9_000 : 5_000);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByText('БАРМЕН', { exact: true })).toBeVisible();

  await page.screenshot({
    path: `output/playwright/running-${testInfo.project.name}.png`,
    fullPage: false,
  });

  // Chromium's headless compositor can mis-capture WebGL layers. Reading the
  // development framebuffer directly gives a trustworthy scene artifact.
  const rawCanvas = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL('image/png'),
  );
  writeFileSync(
    `output/playwright/webgl-buffer-${testInfo.project.name}.png`,
    Buffer.from(rawCanvas.slice(rawCanvas.indexOf(',') + 1), 'base64'),
  );

  expect(runtimeErrors).toEqual([]);
});
