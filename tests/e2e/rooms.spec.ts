import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const fundedSave = {
  coins: 5_000,
  reputation: 3,
  served: 0,
  day: 1,
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
  test.setTimeout(120_000);
  mkdirSync('output/playwright', { recursive: true });
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.addInitScript((save) => {
    Math.random = () => 0.5;
    window.localStorage.setItem('hops-and-honey-save-v1', JSON.stringify(save));
  }, fundedSave);

  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть бар' }).click();
  const panel = page.locator('.upgrade-panel');
  if (!(await panel.evaluate((element) => element.classList.contains('is-open')))) {
    await page.getByRole('button', { name: 'Улучшения бара' }).click();
  }

  const karaokeTab = page.getByRole('tab', { name: /Караоке/ });
  await karaokeTab.click();
  await expect(karaokeTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Караоке-зал', level: 2 })).toBeVisible();
  await expect(page.getByText('ТРЕБУЕТ РЕМОНТА')).toBeVisible();
  await page.getByRole('button', { name: /Открыть и отремонтировать/ }).click();

  await expect(page.getByText('КОМНАТА РАБОТАЕТ')).toBeVisible();
  await expect(page.locator('.staff-card')).toContainText('Ведущий караоке');
  await expect(page.locator('.room-upgrade-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Опытный ведущий/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Доп. микрофон/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Звук и каталог/ })).toBeVisible();

  await page.getByRole('button', { name: /Доп. микрофон/ }).click();
  await expect(page.getByRole('button', { name: /Доп. микрофон, уровень 2/ })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `output/playwright/room-karaoke-${testInfo.project.name}.png`, fullPage: false });

  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);

  for (const room of [
    { tab: /Сауна/, heading: 'Финская сауна', staff: 'Банщик', file: 'sauna' },
    { tab: /Массаж/, heading: 'Массажный кабинет', staff: 'Массажист', file: 'massage' },
  ]) {
    const tab = page.getByRole('tab', { name: room.tab });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: room.heading, level: 2 })).toBeVisible();
    await expect(page.getByText('ТРЕБУЕТ РЕМОНТА')).toBeVisible();
    await page.getByRole('button', { name: /Открыть и отремонтировать/ }).click();
    await expect(page.getByText('КОМНАТА РАБОТАЕТ')).toBeVisible();
    await expect(page.locator('.staff-card')).toContainText(room.staff);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `output/playwright/room-${room.file}-${testInfo.project.name}.png`, fullPage: false });
  }

  await page.getByRole('button', { name: 'Закрыть улучшения' }).click();
  await page.getByRole('button', { name: /Вернуться в главный зал/ }).click();
  await page.getByRole('button', { name: 'Скорость игры x1' }).click();
  await expect(page.getByRole('button', { name: 'Скорость игры x2' })).toBeVisible();
  await page.getByRole('button', { name: 'Улучшения бара' }).click();
  await page.getByRole('tab', { name: /Сауна/ }).click();
  await page.getByRole('button', { name: 'Закрыть улучшения' }).click();

  const hasRoomGuest = async () => page.locator('.world-emoji').evaluateAll((nodes) => nodes.some((node) => (
    node.getAttribute('aria-label') === 'В комнате: Сауна'
  )));
  await expect.poll(hasRoomGuest, { timeout: 55_000, intervals: [250] }).toBe(true);
  const roomGuestLabel = await page.locator('.world-emoji').evaluateAll((nodes) => nodes
    .map((node) => node.getAttribute('aria-label'))
    .find((label) => label?.startsWith('В комнате:')) ?? '');
  expect(roomGuestLabel).toBe('В комнате: Сауна');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `output/playwright/room-live-guest-${testInfo.project.name}.png`, fullPage: false });

  expect(runtimeErrors).toEqual([]);
  // Explicitly dispose the continuously-rendering WebGL scene so the long
  // walkthrough also shuts down reliably on GPU-constrained test machines.
  await page.goto('about:blank', { waitUntil: 'commit', timeout: 5_000 });
});
