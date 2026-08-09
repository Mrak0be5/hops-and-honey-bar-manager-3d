import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('captures a representative running bar scene', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  mkdirSync('output/playwright', { recursive: true });

  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click();

  const canvas = page.locator('canvas.presentation-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(120);
  const openingPageImage = await page.screenshot({
    path: `output/playwright/opening-${testInfo.project.name}.png`,
    fullPage: false,
  });
  const openingRawCanvas = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL('image/png'),
  );
  const openingCanvasImage = Buffer.from(
    openingRawCanvas.slice(openingRawCanvas.indexOf(',') + 1),
    'base64',
  );
  expect(openingPageImage.byteLength).toBeGreaterThan(openingCanvasImage.byteLength * 0.55);
  await expect(page.locator('.pause-scrim')).toHaveCount(0);

  const panel = page.locator('#upgrade-panel');
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Управление', exact: true }).click();
    await expect(panel).toHaveClass(/is-open/);
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `output/playwright/upgrades-${testInfo.project.name}.png`,
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Закрыть управление' }).click();
  } else if (await panel.evaluate((element) => element.classList.contains('is-open'))) {
    await page.getByRole('button', { name: 'Управление', exact: true }).click();
  }

  await page.waitForTimeout(testInfo.project.name === 'desktop-chromium' ? 9_000 : 5_000);
  await expect(page.locator('.game-canvas')).toHaveCSS('visibility', 'hidden');
  // Portrait mode deliberately hides redundant patron markers and keeps one
  // useful status marker, which is not necessarily first in DOM order.
  await expect(page.locator('.world-status-marker:visible').first()).toBeVisible();
  await expect(page.locator('.pause-scrim')).toHaveCount(0);
  await expect(page.locator('.bottom-status')).toBeVisible();

  const pageImage = await page.screenshot({
    path: `output/playwright/running-${testInfo.project.name}.png`,
    fullPage: false,
  });

  // The presentation canvas is the browser-compatible copy of the WebGL frame.
  // Reading it directly provides a trustworthy scene artifact for visual QA.
  const rawCanvas = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL('image/png'),
  );
  const canvasImage = Buffer.from(rawCanvas.slice(rawCanvas.indexOf(',') + 1), 'base64');
  writeFileSync(`output/playwright/webgl-buffer-${testInfo.project.name}.png`, canvasImage);

  // A broken Chromium compositor produced a highly-compressible flat field even
  // while the canvas buffer was detailed. Keep the visible page similarly rich.
  expect(pageImage.byteLength).toBeGreaterThan(canvasImage.byteLength * 0.55);

  expect(runtimeErrors).toEqual([]);
});
