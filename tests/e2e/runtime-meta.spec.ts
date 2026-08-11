import { expect, test, type Locator } from '@playwright/test';

type Bounds = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

function expectInside(inner: Bounds, outer: Bounds, tolerance = 1) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + tolerance);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + tolerance);
}

function overlaps(first: Bounds, second: Bounds) {
  return !(
    first.x + first.width <= second.x
    || second.x + second.width <= first.x
    || first.y + first.height <= second.y
    || second.y + second.height <= first.y
  );
}

test('shows measured presented FPS and the release version in opposite bottom corners', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  if (testInfo.project.name !== 'desktop-chromium') {
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.goto('/');
  await page.locator('.start-button').click();

  const shell = page.locator('.game-shell');
  const fps = page.locator('.fps-counter');
  const version = page.locator('.game-version');
  await expect(version).toHaveText('v0.1.2');
  await expect(fps).toContainText('FPS');
  await expect.poll(async () => Number(await fps.getAttribute('data-fps')), {
    message: 'presented WebGL FPS should become available after warm-up',
    timeout: 20_000,
  }).toBeGreaterThan(0);

  const shellBounds = await shell.boundingBox();
  const fpsBounds = await fps.boundingBox();
  const versionBounds = await version.boundingBox();
  expect(shellBounds).not.toBeNull();
  expect(fpsBounds).not.toBeNull();
  expect(versionBounds).not.toBeNull();
  expectInside(fpsBounds!, shellBounds!);
  expectInside(versionBounds!, shellBounds!);
  expect(fpsBounds!.x).toBeLessThan(shellBounds!.x + shellBounds!.width / 2);
  expect(versionBounds!.x + versionBounds!.width).toBeGreaterThan(shellBounds!.x + shellBounds!.width / 2);
  expect(overlaps(fpsBounds!, versionBounds!)).toBe(false);
  await expect(page.locator('.runtime-meta')).toHaveCSS('pointer-events', 'none');

  for (const selector of ['.control-strip', '.bottom-status', '.expansion-progress']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds, `${selector} must have layout bounds`).not.toBeNull();
    expect(overlaps(fpsBounds!, bounds!)).toBe(false);
    expect(overlaps(versionBounds!, bounds!)).toBe(false);
  }

  await page.screenshot({
    path: `output/playwright/runtime-meta-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('keeps both runtime badges inside the desktop 9:16 shell', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The in-page 9:16 preview is a desktop control');
  test.setTimeout(120_000);

  await page.goto('/');
  await page.locator('.start-button').click();
  await page.locator('.viewport-mode-toggle').click();

  const shellBounds = await page.locator('.game-shell').boundingBox();
  const fpsBounds = await page.locator('.fps-counter').boundingBox();
  const versionBounds = await page.locator('.game-version').boundingBox();
  expect(shellBounds).not.toBeNull();
  expect(fpsBounds).not.toBeNull();
  expect(versionBounds).not.toBeNull();
  expectInside(fpsBounds!, shellBounds!);
  expectInside(versionBounds!, shellBounds!);
  await expect.poll(async () => Number(await page.locator('.fps-counter').getAttribute('data-fps')), {
    timeout: 20_000,
  }).toBeGreaterThan(0);
  const toggleBounds = await page.locator('.viewport-mode-toggle').boundingBox();
  expect(toggleBounds).not.toBeNull();
  expect(overlaps(versionBounds!, toggleBounds!)).toBe(false);
});
