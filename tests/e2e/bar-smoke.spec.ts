import { expect, test } from '@playwright/test';

test('opens the bar and exposes the full upgrade surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Бордель/ })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  await expect(page.locator('.bottom-status')).toBeVisible();
  const panel = page.locator('#upgrade-panel');
  if (!(await panel.evaluate((element) => element.classList.contains('is-open')))) {
    await page.getByRole('button', { name: 'Управление', exact: true }).click();
  }
  await expect(panel).toHaveClass(/is-open/);
  await expect(page.getByRole('heading', { name: 'Улучшения зала' })).toBeVisible();
  await expect(page.locator('.upgrade-card')).toHaveCount(6);
});

test('fits the mobile viewport without horizontal document overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
});

test('keeps hidden controls out of the welcome-screen tab order', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  const startButton = page.getByRole('button', { name: 'Открыть бордель' });
  await page.keyboard.press('Tab');
  await expect(startButton).toBeFocused();
});

test('keeps sound available and collapsed upgrades inert on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  await expect(page.getByRole('button', { name: /звук/i })).toBeVisible();
  await expect(page.locator('#upgrade-panel')).toHaveAttribute('inert', '');
  await expect(page.locator('#staff-panel')).toHaveAttribute('inert', '');
});

test('uses a touch-friendly portrait dock and contained upgrade sheet', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Portrait dock is covered by the mobile project');
  test.setTimeout(180_000);
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Открыть бордель' }).click();

    const dock = page.locator('.control-strip');
    const dockBounds = await dock.boundingBox();
    expect(dockBounds).not.toBeNull();
    expect(dockBounds!.y + dockBounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(dockBounds!.height).toBeGreaterThanOrEqual(70);

    const buttons = dock.locator('.icon-button');
    await expect(buttons).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      const bounds = await buttons.nth(index).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }

    const statusBounds = await page.locator('.bottom-status').boundingBox();
    expect(statusBounds).not.toBeNull();
    expect(statusBounds!.y + statusBounds!.height).toBeLessThanOrEqual(dockBounds!.y + 1);

    const upgradeButton = page.getByRole('button', { name: 'Управление', exact: true });
    await expect(upgradeButton).toHaveAttribute('aria-expanded', 'false');
    await upgradeButton.click();
    await expect(upgradeButton).toHaveAttribute('aria-expanded', 'true');
    await expect(upgradeButton.locator('img')).toHaveAttribute('src', /upgrade-arrow\.webp$/);

    const panel = page.locator('#upgrade-panel');
    await expect(panel).toHaveClass(/is-open/);
    const panelBounds = await panel.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(dockBounds!.y + 1);

    await expect(page.locator('.brand-card')).toBeVisible();
    await expect(page.locator('.currency-strip')).toBeVisible();
    await expect(page.getByRole('button', { name: /К сцене/ })).toBeVisible();

    await panel.locator('.upgrade-card').last().scrollIntoViewIfNeeded();
    await expect(panel.locator('.upgrade-card').last()).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть управление' }).click();
    await expect(upgradeButton).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Штат', exact: true }).click();
    await expect(page.locator('#staff-panel')).toHaveClass(/is-open/);
    await expect(page.getByRole('heading', { name: 'Штат', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть штат' }).click();
  }
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

test('iPhone 15 manage sheet unlocks a room with large touch targets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'iPhone 15 portrait path');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript((save) => {
    window.localStorage.setItem('brothel-christopher-v1', JSON.stringify(save));
  }, {
    coins: 5_000,
    reputation: 3,
    served: 0,
    day: 1,
    hired: ['christina', 'tigra'],
    venueSlots: {
      bar: ['christina', null],
      strip: ['tigra', null],
      sex: [null, null],
      gangbang: [null, null],
    },
    upgrades: {
      moveSpeed: 1,
      orderSpeed: 1,
      prepSpeed: 1,
      cleanSpeed: 1,
      assortment: 1,
      advertising: 1,
    },
    soundEnabled: true,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  const panel = page.locator('#upgrade-panel');
  await expect(panel).toHaveClass(/is-open/);
  await page.getByRole('tab', { name: /Стрип/ }).click();
  const unlock = page.getByRole('button', { name: /Открыть и отремонтировать/ });
  await expect(unlock).toBeVisible();
  const unlockBox = await unlock.boundingBox();
  expect(unlockBox).not.toBeNull();
  expect(unlockBox!.height).toBeGreaterThanOrEqual(44);
  await unlock.click();
  await expect(page.getByText('КОМНАТА РАБОТАЕТ')).toBeVisible();
  await expect(page.locator('.room-upgrade-card')).toHaveCount(3);
  await expect(page.locator('.upgrade-delta').first()).toBeVisible();
});
