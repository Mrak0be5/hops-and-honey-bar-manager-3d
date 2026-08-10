import { expect, test, type Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const fundedSave = {
  coins: 1_000_000_000,
  reputation: 1_000_000,
  served: 0,
  day: 1,
  upgrades: {
    moveSpeed: 1,
    orderSpeed: 1,
    prepSpeed: 1,
    cleanSpeed: 1,
    assortment: 1,
    advertising: 1,
  },
  soundEnabled: true,
};

async function buyUntilMax(button: Locator, clickLimit: number) {
  // Keep all repeated purchases in one browser round-trip. A macrotask between
  // clicks gives React time to commit the new level and disabled/MAX state.
  await button.evaluate(async (element, limit) => {
    const target = element as HTMLButtonElement;
    for (let click = 0; click < limit && !target.disabled; click += 1) {
      target.click();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }, clickLimit);
  await expect(button).toBeDisabled();
  await expect(button).toContainText('MAX');
}

async function expectCardsFitHorizontally(cards: Locator) {
  const measurements = await cards.evaluateAll((elements) => elements.map((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
  })));
  for (const measurement of measurements) {
    expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.clientWidth + 1);
    expect(measurement.left).toBeGreaterThanOrEqual(0);
    expect(measurement.right).toBeLessThanOrEqual(376);
  }
}

test('opens every development window and buys every upgrade to its maximum level', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  mkdirSync('output/playwright', { recursive: true });
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.addInitScript((save) => {
    window.localStorage.setItem('hops-and-honey-save-v1', JSON.stringify(save));
  }, fundedSave);

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  await page.getByRole('button', { name: 'Улучшения бара' }).click();

  const panel = page.locator('.upgrade-panel');
  await expect(panel).toHaveClass(/is-open/);
  await expect(panel.locator('.venue-tabs [role="tab"]')).toHaveCount(4);
  await expect(panel.locator('.milestone-card, .drink-ribbon')).toHaveCount(0);

  const barUpgrades = panel.locator('[data-upgrade-key]');
  await expect(barUpgrades).toHaveCount(6);
  await expect(barUpgrades.locator('.upgrade-effect')).toHaveCount(6);

  const moveSpeed = panel.locator('[data-upgrade-key="moveSpeed"]');
  await expect(moveSpeed.locator('.upgrade-effect-label')).toHaveText('Скорость бармена');
  await expect(moveSpeed.locator('.upgrade-effect-current')).toHaveText('2,15');
  await expect(moveSpeed.locator('.upgrade-effect-next')).toHaveText('2,49');
  await expect(moveSpeed.locator('.upgrade-effect-unit')).toHaveText('м/с');
  await moveSpeed.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(moveSpeed.locator('.upgrade-effect-current')).toHaveText('2,49');
  await expect(moveSpeed.locator('.upgrade-effect-next')).toHaveText('2,84');

  if (testInfo.project.name === 'iphone-9x16-webkit') {
    await expectCardsFitHorizontally(barUpgrades);
  }

  for (const key of ['moveSpeed', 'orderSpeed', 'prepSpeed', 'cleanSpeed', 'assortment', 'advertising']) {
    const upgrade = panel.locator(`[data-upgrade-key="${key}"]`);
    await buyUntilMax(upgrade, 12);
    await expect(upgrade.locator('.upgrade-effect-current')).not.toHaveText('');
    await expect(upgrade.locator('.upgrade-effect-next')).toHaveCount(0);
  }
  if (testInfo.project.name === 'iphone-9x16-webkit') {
    await page.screenshot({ path: `output/playwright/max-bar-upgrades-${testInfo.project.name}.png`, fullPage: false });
  }

  const roomTabs = panel.locator('.venue-tabs [role="tab"]');
  const roomExpectations = [
    {
      id: 'karaoke',
      staff: ['36,00', '30,60'],
      capacity: ['1', '2', '20 → 40'],
      quality: ['20', '23'],
    },
    {
      id: 'sauna',
      staff: ['42,00', '35,70'],
      capacity: ['1', '2', '42 → 84'],
      quality: ['42', '48'],
    },
    {
      id: 'massage',
      staff: ['45,00', '38,25'],
      capacity: ['1', '2', '70 → 140'],
      quality: ['70', '81'],
    },
  ] as const;
  for (let roomIndex = 1; roomIndex < 4; roomIndex += 1) {
    const expected = roomExpectations[roomIndex - 1];
    await roomTabs.nth(roomIndex).click();
    await expect(roomTabs.nth(roomIndex)).toHaveAttribute('aria-selected', 'true');
    await expect(panel.locator('.milestone-card, .drink-ribbon')).toHaveCount(0);
    await expect(panel.locator('.room-development')).toHaveClass(/is-locked/);
    await panel.locator('.unlock-room-button').click();
    await expect(panel.locator('.room-development')).toHaveClass(/is-open/);

    const roomUpgrades = panel.locator('[data-room-upgrade-key]');
    await expect(roomUpgrades).toHaveCount(3);
    await expect(roomUpgrades.locator('.upgrade-effect')).toHaveCount(3);

    const staff = panel.locator('[data-room-upgrade-key="staffSpeed"]');
    const capacity = panel.locator('[data-room-upgrade-key="capacity"]');
    const quality = panel.locator('[data-room-upgrade-key="quality"]');
    await expect(staff.locator('.upgrade-effect-current')).toHaveText(expected.staff[0]);
    await expect(staff.locator('.upgrade-effect-next')).toHaveText(expected.staff[1]);
    await expect(capacity.locator('.upgrade-effect-current')).toHaveText(expected.capacity[0]);
    await expect(capacity.locator('.upgrade-effect-next')).toHaveText(expected.capacity[1]);
    await expect(capacity.locator('.upgrade-effect-detail')).toContainText(expected.capacity[2]);
    await expect(quality.locator('.upgrade-effect-current')).toHaveText(expected.quality[0]);
    await expect(quality.locator('.upgrade-effect-next')).toHaveText(expected.quality[1]);

    if (testInfo.project.name === 'iphone-9x16-webkit') {
      await expectCardsFitHorizontally(roomUpgrades);
    }

    for (const key of ['staffSpeed', 'capacity', 'quality']) {
      const upgrade = panel.locator(`[data-room-upgrade-key="${key}"]`);
      await buyUntilMax(upgrade, 6);
      await expect(upgrade.locator('.upgrade-effect-current')).not.toHaveText('');
      await expect(upgrade.locator('.upgrade-effect-next')).toHaveCount(0);
    }
    if (testInfo.project.name === 'iphone-9x16-webkit') {
      await page.screenshot({ path: `output/playwright/max-room-${roomIndex}-${testInfo.project.name}.png`, fullPage: false });
    }
  }

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    panel: (() => {
      const rect = document.querySelector('.upgrade-panel')?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
    })(),
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.panel).not.toBeNull();
  expect(layout.panel!.left).toBeGreaterThanOrEqual(0);
  expect(layout.panel!.right).toBeLessThanOrEqual(layout.viewportWidth + 1);

  const saved = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('hops-and-honey-save-v1') ?? '{}',
  ));
  expect(saved.upgrades).toEqual({
    moveSpeed: 6,
    orderSpeed: 6,
    prepSpeed: 6,
    cleanSpeed: 6,
    assortment: 5,
    advertising: 8,
  });
  expect(saved.rooms).toMatchObject({
    karaoke: { unlocked: true, upgrades: { staffSpeed: 5, capacity: 3, quality: 5 } },
    sauna: { unlocked: true, upgrades: { staffSpeed: 5, capacity: 4, quality: 5 } },
    massage: { unlocked: true, upgrades: { staffSpeed: 5, capacity: 2, quality: 5 } },
  });

  expect(runtimeErrors).toEqual([]);
  await page.evaluate(() => document.querySelector('canvas')?.remove());
});
