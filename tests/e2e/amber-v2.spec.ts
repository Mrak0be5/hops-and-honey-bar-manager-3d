import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const ARTIFACT_DIR = 'output/playwright';
mkdirSync(ARTIFACT_DIR, { recursive: true });
test.describe.configure({ timeout: 120_000 });

const screenshotPath = (name: string, projectName: string) => (
  `${ARTIFACT_DIR}/amber-v2-${name}-${projectName}.png`
);

const readWebglBuffer = async (page: Page) => {
  const dataUrl = await page.locator('canvas').first().evaluate((element) => new Promise<string>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve((element as HTMLCanvasElement).toDataURL('image/png'));
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 750);
  }));
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
};

const waitForWebglFrame = async (page: Page) => {
  let image = Buffer.alloc(0);
  await expect.poll(async () => {
    image = await readWebglBuffer(page);
    return image.byteLength;
  }, {
    intervals: [250, 500, 1_000],
    message: 'The WebGL framebuffer should contain venue detail, not a flat 1.5KB field',
    timeout: 45_000,
  }).toBeGreaterThan(20_000);
  return image;
};

const captureWebglBuffer = async (page: Page, name: string, projectName: string) => {
  const image = await waitForWebglFrame(page);
  writeFileSync(screenshotPath(`canvas-${name}`, projectName), image);
  return image;
};

const waitForTestBridge = async (page: Page) => {
  await expect.poll(
    () => page.evaluate(() => Boolean(window.__HH_TEST__)),
    { message: 'The development-only Amber Club bridge should be installed' },
  ).toBe(true);
};

const readView = async (page: Page) => page.evaluate(() => {
  if (!window.__HH_TEST__) throw new Error('Amber Club test bridge is unavailable');
  return window.__HH_TEST__.getViewSnapshot();
});

const RUNTIME_ERRORS = new WeakMap<Page, string[]>();

const observeRuntimeErrors = (page: Page) => {
  const errors: string[] = [];
  RUNTIME_ERRORS.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
};

const runtimeErrorsFor = (page: Page) => RUNTIME_ERRORS.get(page) ?? [];

test.beforeEach(async ({ page }, testInfo) => {
  const runtimeErrors = observeRuntimeErrors(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  try {
    await expect(page.locator('.amber-club-shell')).toBeVisible();
  } catch (error) {
    await page.screenshot({
      path: screenshotPath('boot-failure', testInfo.project.name),
      fullPage: false,
    });
    await testInfo.attach('boot-runtime-errors', {
      body: Buffer.from(JSON.stringify(runtimeErrors, null, 2)),
      contentType: 'application/json',
    });
    throw error;
  }
  await waitForTestBridge(page);
  await waitForWebglFrame(page);
});

test.afterEach(async ({ page }) => {
  const canvas = page.locator('canvas').first();
  if (await canvas.count()) {
    await canvas.evaluate((element) => {
      const webglCanvas = element as HTMLCanvasElement;
      const gl = webglCanvas.getContext('webgl2') ?? webglCanvas.getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }).catch(() => undefined);
  }
  await page.close({ runBeforeUnload: false }).catch(() => undefined);
});

test('boots into one clear action and starts a playable shift', async ({ page }, testInfo) => {
  const runtimeErrors = runtimeErrorsFor(page);

  await expect(page.getByRole('heading', { name: 'Вечер начинается' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Открыть смену/ })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({
    path: screenshotPath('boot', testInfo.project.name),
    fullPage: false,
  });

  await page.getByRole('button', { name: /Открыть смену/ }).click();
  await expect(page.getByRole('heading', { name: 'Вечер начинается' })).toHaveCount(0);
  await expect.poll(async () => (await readView(page)).started).toBe(true);
  await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible();
  await page.waitForTimeout(250);
  await captureWebglBuffer(page, 'started', testInfo.project.name);
  await page.screenshot({
    path: screenshotPath('started', testInfo.project.name),
    fullPage: false,
  });

  expect(runtimeErrors).toEqual([]);
});

test('pause, speed and sound controls stay synchronized with runtime state', async ({ page }, testInfo) => {
  const runtimeErrors = runtimeErrorsFor(page);
  await page.getByRole('button', { name: /Открыть смену/ }).click();

  await page.getByRole('button', { name: 'Пауза' }).click();
  await expect(page.getByRole('button', { name: 'Продолжить игру' })).toBeVisible();
  await expect.poll(async () => (await readView(page)).paused).toBe(true);
  await page.getByRole('button', { name: 'Продолжить игру' }).first().click();
  await expect.poll(async () => (await readView(page)).paused).toBe(false);

  const speedButton = page.getByRole('button', { name: 'Изменить скорость' });
  await expect(speedButton).toContainText('×1');
  await speedButton.click();
  await expect(speedButton).toContainText('×2');
  await expect.poll(async () => (await readView(page)).speed).toBe(2);

  const soundButton = page.getByRole('button', { name: 'Выключить звук' });
  await expect(soundButton).toBeVisible();
  await soundButton.click();
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible();
  await expect.poll(async () => (await readView(page)).soundEnabled).toBe(false);

  await page.screenshot({
    path: screenshotPath('controls', testInfo.project.name),
    fullPage: false,
  });
  expect(runtimeErrors).toEqual([]);
});

test('room drawer explains locked-room affordability without covering navigation', async ({ page }, testInfo) => {
  const runtimeErrors = runtimeErrorsFor(page);
  await page.getByRole('button', { name: /Открыть смену/ }).click();

  await page.getByRole('button', { name: 'Массаж' }).click();
  const drawer = page.locator('.amber-room-drawer');
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.getByRole('heading', { name: 'Массаж' })).toBeVisible();
  await expect(drawer.getByText('Требует ремонта')).toBeVisible();
  const unlockButton = drawer.getByRole('button', { name: /Оплатить проект/ });
  await expect(unlockButton).toBeDisabled();
  await expect(drawer.getByText(/Нужно ещё/)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Комнаты клуба' })).toBeVisible();

  await page.screenshot({
    path: screenshotPath('locked-massage', testInfo.project.name),
    fullPage: false,
  });

  const closeButton = drawer.getByRole('button', { name: 'Закрыть панель' });
  const closeBounds = await closeButton.boundingBox();
  const viewport = page.viewportSize();
  expect(closeBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect.soft(closeBounds!.x).toBeGreaterThanOrEqual(0);
  expect.soft(closeBounds!.y).toBeGreaterThanOrEqual(0);
  expect.soft(closeBounds!.x + closeBounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect.soft(closeBounds!.y + closeBounds!.height).toBeLessThanOrEqual(viewport!.height);
  await closeButton.click({ force: true });
  await expect(drawer).not.toHaveClass(/is-open/);
  expect(runtimeErrors).toEqual([]);
});

test('development bridge proves guests complete the bar before choosing a room', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const runtimeErrors = runtimeErrorsFor(page);

  const flow = await page.evaluate(() => {
    const bridge = window.__HH_TEST__;
    if (!bridge) throw new Error('Amber Club test bridge is unavailable');
    bridge.start();

    for (let batch = 0; batch < 420 && bridge.getSimulationSnapshot().balance < 750; batch += 1) {
      bridge.advanceTicks(20);
    }
    const balanceBeforeUnlock = bridge.getSimulationSnapshot().balance;
    bridge.unlockRoom('karaoke');
    const karaokeUnlocked = bridge.getSimulationSnapshot().rooms.find((room) => room.id === 'karaoke')?.unlocked ?? false;

    let chosenGuestId: string | null = null;
    for (let batch = 0; batch < 240; batch += 1) {
      bridge.advanceTicks(20);
      const snapshot = bridge.getSimulationSnapshot();
      const roomGuest = snapshot.guests.find((guest) => (
        guest.roomVisit
        && guest.barVisit.completed
        && ['walking_to_room', 'waiting_room', 'in_room'].includes(guest.phase)
      ));
      if (roomGuest) {
        chosenGuestId = roomGuest.id;
        break;
      }
    }

    const snapshot = bridge.getSimulationSnapshot();
    const guest = snapshot.guests.find((candidate) => candidate.id === chosenGuestId) ?? null;
    const guestEvents = chosenGuestId
      ? snapshot.events.filter((event) => event.guestId === chosenGuestId)
      : [];
    const paidIndex = guestEvents.findIndex((event) => (
      event.kind === 'guest_phase_changed' && event.toPhase === 'choosing_room'
    ));
    const roomChoiceIndex = guestEvents.findIndex((event) => event.kind === 'room_visit_requested');

    return {
      barCompleted: guest?.barVisit.completed ?? false,
      balanceBeforeUnlock,
      guestId: chosenGuestId,
      karaokeUnlocked,
      paidAtTick: guest?.barVisit.paidAtTick ?? null,
      phase: guest?.phase ?? null,
      roomId: guest?.roomVisit?.roomId ?? null,
      paidIndex,
      roomChoiceIndex,
    };
  });

  expect(flow.guestId).not.toBeNull();
  expect(flow.balanceBeforeUnlock).toBeGreaterThanOrEqual(750);
  expect(flow.karaokeUnlocked).toBe(true);
  expect(flow.barCompleted).toBe(true);
  expect(flow.paidAtTick).not.toBeNull();
  expect(flow.roomId).toBe('karaoke');
  expect(flow.paidIndex).toBeGreaterThanOrEqual(0);
  expect(flow.roomChoiceIndex).toBeGreaterThan(flow.paidIndex);
  expect(['walking_to_room', 'waiting_room', 'in_room']).toContain(flow.phase);

  await expect.poll(async () => (await readView(page)).characters.some((character) => (
    character.role === 'patron' && character.roomId === 'karaoke'
  ))).toBe(true);
  await page.waitForTimeout(250);
  await captureWebglBuffer(page, 'guest-to-karaoke', testInfo.project.name);
  await page.screenshot({
    path: screenshotPath('guest-to-karaoke', testInfo.project.name),
    fullPage: false,
  });
  expect(runtimeErrors).toEqual([]);
});

test('desktop and mobile layouts stay inside the viewport with the drawer open', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /Открыть смену/ }).click();
  await page.getByRole('button', { name: 'Массаж' }).click();
  await expect(page.locator('.amber-room-drawer')).toHaveClass(/is-open/);
  await page.screenshot({
    path: screenshotPath('responsive-drawer', testInfo.project.name),
    fullPage: false,
  });

  const geometry = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.amber-club-shell')?.getBoundingClientRect();
    const drawer = document.querySelector<HTMLElement>('.amber-room-drawer')?.getBoundingClientRect();
    return {
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      drawer: drawer ? { bottom: drawer.bottom, left: drawer.left, right: drawer.right, top: drawer.top } : null,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      shell: shell ? { bottom: shell.bottom, height: shell.height, left: shell.left, right: shell.right, top: shell.top, width: shell.width } : null,
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight);
  expect(geometry.shell).not.toBeNull();
  expect(geometry.shell!.left).toBeCloseTo(0, 0);
  expect(geometry.shell!.top).toBeCloseTo(0, 0);
  expect(geometry.shell!.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.shell!.bottom).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.shell!.width).toBeGreaterThanOrEqual(geometry.clientWidth - 1);
  expect(geometry.shell!.height).toBeGreaterThanOrEqual(geometry.clientHeight - 1);
  expect(geometry.drawer).not.toBeNull();
  expect(geometry.drawer!.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.drawer!.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.drawer!.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.drawer!.bottom).toBeLessThanOrEqual(geometry.clientHeight + 1);
});
