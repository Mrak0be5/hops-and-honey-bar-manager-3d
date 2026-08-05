import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const fundedSave = {
  coins: 5_000,
  reputation: 3,
  served: 0,
  day: 1,
  hired: ['christina', 'tigra', 'winna', 'krolya'],
  venueSlots: {
    bar: ['christina', null],
    strip: ['tigra', null],
    sex: ['winna', null],
    gangbang: ['krolya', null],
  },
  upgrades: {
    moveSpeed: 10,
    orderSpeed: 10,
    prepSpeed: 10,
    cleanSpeed: 10,
    assortment: 1,
    advertising: 8,
  },
  soundEnabled: true,
};

test('repairs the connected rooms and walks a served bar guest into one', async ({ page }, testInfo) => {
  // WebGL startup can be slow on software-rendered CI machines. Keep the
  // gameplay assertion strict while allowing the scene enough warm-up time.
  test.setTimeout(180_000);
  mkdirSync('output/playwright', { recursive: true });
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.addInitScript((save) => {
    Math.random = () => 0.5;
    window.localStorage.setItem('brothel-christopher-v1', JSON.stringify(save));
  }, fundedSave);

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  const panel = page.locator('.upgrade-panel');
  if (!(await panel.evaluate((element) => element.classList.contains('is-open')))) {
    await page.getByRole('button', { name: 'Улучшения борделя' }).click();
  }

  const karaokeTab = page.getByRole('tab', { name: /Стрип/ });
  await karaokeTab.click();
  await expect(karaokeTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Стрип-зал', level: 2 })).toBeVisible();
  await expect(page.getByText('ТРЕБУЕТ РЕМОНТА')).toBeVisible();
  await page.getByRole('button', { name: /Открыть и отремонтировать/ }).click();

  await expect(page.getByText('КОМНАТА РАБОТАЕТ')).toBeVisible();
  await expect(page.locator('.staff-card')).toContainText('ПЕРСОНАЛ');
  await expect(page.locator('.room-upgrade-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Темп шоу/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Лишний стул у сцены/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Свет и музыка/ })).toBeVisible();

  await page.getByRole('button', { name: /Лишний стул у сцены/ }).click();
  await expect(page.getByRole('button', { name: /Лишний стул у сцены, уровень 2/ })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `output/playwright/room-strip-${testInfo.project.name}.png`, fullPage: false });

  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);

  for (const room of [
    { tab: /Секс/, heading: 'Комната удовольствий', file: 'sex' },
    { tab: /Оргия/, heading: 'Зал оргии', file: 'gangbang' },
  ]) {
    const tab = page.getByRole('tab', { name: room.tab });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: room.heading, level: 2 })).toBeVisible();
    await expect(page.getByText('ТРЕБУЕТ РЕМОНТА')).toBeVisible();
    await page.getByRole('button', { name: /Открыть и отремонтировать/ }).click();
    await expect(page.getByText('КОМНАТА РАБОТАЕТ')).toBeVisible();
    await expect(page.locator('.staff-card')).toContainText('ПЕРСОНАЛ');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `output/playwright/room-${room.file}-${testInfo.project.name}.png`, fullPage: false });
  }

  await page.getByRole('button', { name: 'Закрыть улучшения' }).click();
  await page.getByRole('button', { name: /Вернуться в главный зал/ }).click();
  await page.getByRole('button', { name: 'Скорость игры x1' }).click();
  await expect(page.getByRole('button', { name: 'Скорость игры x2' })).toBeVisible();
  await page.getByRole('button', { name: 'Улучшения борделя' }).click();
  await page.getByRole('tab', { name: /Секс/ }).click();
  await page.getByRole('button', { name: 'Закрыть улучшения' }).click();

  const hasRoomGuest = async () => page.locator('.world-emoji').evaluateAll((nodes) => nodes.some((node) => {
    const label = node.getAttribute('aria-label') ?? '';
    return label.startsWith('В комнате:') || label.startsWith('Идёт в') || label.startsWith('Ждёт сеанс:');
  }));
  await expect.poll(hasRoomGuest, { timeout: 90_000, intervals: [250] }).toBe(true);
  const roomGuestLabel = await page.locator('.world-emoji').evaluateAll((nodes) => nodes
    .map((node) => node.getAttribute('aria-label'))
    .find((label) => label?.startsWith('В комнате:') || label?.startsWith('Идёт в') || label?.startsWith('Ждёт сеанс:')) ?? '');
  expect(roomGuestLabel).toMatch(/^(В комнате:|Идёт в|Ждёт сеанс:)/);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `output/playwright/room-live-guest-${testInfo.project.name}.png`, fullPage: false });

  expect(runtimeErrors).toEqual([]);
  // Explicitly dispose the continuously-rendering WebGL scene so the long
  // walkthrough also shuts down reliably on GPU-constrained test machines.
  await page.goto('about:blank', { waitUntil: 'commit', timeout: 5_000 });
});

test('fresh desktop keeps onboarding isolated and opens development on demand', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop layout assertion');
  const audioWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.text().toLowerCase().includes('audiocontext')) audioWarnings.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.removeItem('brothel-christopher-v1'));
  await page.goto('/');

  const welcome = page.locator('.welcome-card');
  await expect(welcome).toBeVisible();
  await expect(page.locator('.top-hud')).toHaveCount(0);
  await expect(page.locator('.upgrade-panel')).toHaveCount(0);
  const welcomeBox = await welcome.boundingBox();
  expect(welcomeBox).not.toBeNull();
  expect(welcomeBox!.y).toBeGreaterThanOrEqual(0);
  expect(welcomeBox!.y + welcomeBox!.height).toBeLessThanOrEqual(900);

  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  await expect(page.locator('.top-hud')).toBeVisible();
  const panel = page.locator('.upgrade-panel');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(panel).not.toBeVisible();

  await page.getByRole('button', { name: 'Улучшения борделя' }).click();
  await expect(panel).toHaveClass(/is-open/);
  await expect(panel).toBeVisible();
  await expect(page.getByRole('button', { name: 'Закрыть улучшения' })).toBeVisible();
  await expect(panel.locator('.milestone-card')).toContainText('СЛЕДУЮЩАЯ ЦЕЛЬ');
  expect(audioWarnings).toEqual([]);
  await page.goto('about:blank', { waitUntil: 'commit', timeout: 5_000 });
});

test('390px HUD uses compact values and development sheet removes redundant overlays', async ({ page }, testInfo) => {
  test.setTimeout(75_000);
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile layout assertion');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((save) => {
    window.localStorage.setItem('brothel-christopher-v1', JSON.stringify(save));
  }, {
    ...fundedSave,
    coins: 268_000,
    reputation: 1_600,
    served: 1_400,
    soundEnabled: false,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бордель' }).click();
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible();

  const compactValues = page.locator('.currency-value-compact');
  await expect(compactValues).toHaveText(['268K', '1.6K', '1.4K']);
  for (const value of await compactValues.all()) await expect(value).toBeVisible();
  for (const value of await page.locator('.currency-value-full').all()) await expect(value).not.toBeVisible();
  await expect(page.locator('.brand-copy strong')).toHaveText('БОРДЕЛЬ У КРИСТОФЕРА');
  await expect(page.locator('.brand-copy strong')).toBeVisible();

  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

  await page.getByRole('button', { name: 'Улучшения борделя' }).click();
  const panel = page.locator('.upgrade-panel');
  await expect(panel).toBeVisible();
  await expect(page.locator('.brand-card')).not.toBeVisible();
  await expect(page.locator('.currency-strip')).not.toBeVisible();
  await expect(page.locator('.bottom-status')).not.toBeVisible();
  await expect(page.locator('.venue-tabs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Закрыть улучшения' })).toBeVisible();
  expect(await page.locator('.panel-sticky-header').evaluate((element) => getComputedStyle(element).position)).toBe('sticky');

  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.y).toBeGreaterThanOrEqual(0);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(845);
  expect(await page.locator('.world-status-marker:visible').count()).toBeLessThanOrEqual(1);

  await page.getByRole('tab', { name: /Секс/ }).click();
  await expect(panel).toHaveClass(/is-room-view/);
  const roomPanelBox = await panel.boundingBox();
  expect(roomPanelBox).not.toBeNull();
  expect(roomPanelBox!.y).toBeGreaterThanOrEqual(844 * 0.38);
  expect(roomPanelBox!.y).toBeGreaterThanOrEqual(280);
  await page.goto('about:blank', { waitUntil: 'commit', timeout: 5_000 });
});
