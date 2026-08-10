const cdpUrl = process.env.CDP_URL ?? 'http://127.0.0.1:9223';
const targets = await (await fetch(`${cdpUrl}/json`)).json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No Android WebView page target was found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let sequence = 0;
const pending = new Map();
const consoleErrors = [];
const runtimeExceptions = [];

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (waiter) {
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeExceptions.push(message.params.exceptionDetails.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    consoleErrors.push(message.params.entry.text);
  }
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function tapButton(label) {
  const point = await evaluate(`(() => {
    const label = ${JSON.stringify(label)}.toLocaleLowerCase('ru');
    const elements = [...document.querySelectorAll('button')].filter((button) => {
      const text = (button.getAttribute('aria-label') || button.innerText || '')
        .trim().toLocaleLowerCase('ru');
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return text.includes(label) && rect.width > 0 && rect.height > 0 &&
        style.display !== 'none' && style.visibility !== 'hidden' &&
        !button.closest('[inert]');
    }).sort((left, right) => Number(right.matches('.panel-close')) - Number(left.matches('.panel-close')));
    const element = elements[0];
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`Visible button not found: ${label}`);
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y }],
  });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function snapshot() {
  return evaluate(`(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden' && !element.closest('[inert]');
    };
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      started: !document.querySelector('.welcome-layer'),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
        width: canvas.width,
        height: canvas.height,
      })),
      visibleButtons: [...document.querySelectorAll('button')]
        .filter(visible)
        .map((button) => button.getAttribute('aria-label') || button.innerText.trim())
        .filter(Boolean),
      storageKeys: Object.keys(localStorage),
      pauseUiCount: document.querySelectorAll('.pause-scrim, [aria-label="Пауза"]').length,
    };
  })()`);
}

await send('Runtime.enable');
await send('Log.enable');

const report = { initial: await snapshot() };
if (!report.initial.started) {
  await tapButton('Открыть бар');
  await waitFor(`!document.querySelector('.welcome-layer')`);
}
await new Promise((resolve) => setTimeout(resolve, 1200));
report.running = await snapshot();

report.speedLabels = [];
for (let index = 0; index < 8; index += 1) {
  await tapButton('Скорость игры');
  await new Promise((resolve) => setTimeout(resolve, 70));
  report.speedLabels.push(await evaluate(
    `document.querySelector('.brand-speed-button')?.getAttribute('aria-label')`,
  ));
}

await tapButton('Улучшения бара');
await waitFor(`document.querySelector('#upgrade-panel')?.getAttribute('aria-hidden') === 'false'`);
await new Promise((resolve) => setTimeout(resolve, 350));
report.development = await evaluate(`(() => {
  const panel = document.querySelector('#upgrade-panel');
  const rect = panel.getBoundingClientRect();
  return {
    heading: document.querySelector('#upgrade-panel-title')?.textContent,
    tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.innerText.trim()),
    numericUpgradeLabels: [...document.querySelectorAll('.upgrade-card')]
      .map((card) => card.getAttribute('aria-label')),
    oldHintCount: document.querySelectorAll('.milestone-card, .drink-ribbon').length,
    boundsInsideViewport: rect.left >= 0 && rect.top >= 0 &&
      rect.right <= innerWidth && rect.bottom <= innerHeight,
  };
})()`);

await tapButton('Караоке');
await waitFor(`document.querySelector('#upgrade-panel-title')?.textContent?.includes('Караоке')`);
report.karaoke = await evaluate(`({
  heading: document.querySelector('#upgrade-panel-title')?.textContent,
  roomLocked: document.querySelector('#upgrade-panel')?.innerText.includes('ТРЕБУЕТ РЕМОНТА'),
  bodyText: document.querySelector('#upgrade-panel')?.innerText.slice(0, 500),
})`);

await tapButton('Закрыть улучшения');
await waitFor(`document.querySelector('#upgrade-panel')?.getAttribute('aria-hidden') === 'true'`);
await tapButton('Настройки');
await waitFor(`document.querySelector('#settings-dialog')?.closest('.settings-layer')?.getAttribute('aria-hidden') === 'false'`);
await new Promise((resolve) => setTimeout(resolve, 350));
report.settings = await evaluate(`({
  title: document.querySelector('#settings-title')?.textContent,
  soundLabel: document.querySelector('.settings-sound-toggle')?.getAttribute('aria-label'),
  resetInsideSettings: !!document.querySelector('#settings-dialog .reset-button'),
})`);

const originalSoundLabel = report.settings.soundLabel;
await tapButton(originalSoundLabel);
await waitFor(`document.querySelector('.settings-sound-toggle')?.getAttribute('aria-label') !== ${JSON.stringify(originalSoundLabel)}`);
report.settings.soundLabelAfterToggle = await evaluate(
  `document.querySelector('.settings-sound-toggle')?.getAttribute('aria-label')`,
);
await tapButton(report.settings.soundLabelAfterToggle);

await tapButton('Сбросить прогресс');
await waitFor(`!!document.querySelector('.reset-confirmation')`);
report.settings.inlineResetConfirmation = await evaluate(
  `document.querySelector('.reset-confirmation')?.innerText.includes('Сбросить весь прогресс?')`,
);
await tapButton('Отмена');
await waitFor(`!document.querySelector('.reset-confirmation')`);
await tapButton('Закрыть настройки');

await new Promise((resolve) => setTimeout(resolve, 5500));
report.final = await snapshot();
report.consoleErrors = consoleErrors;
report.runtimeExceptions = runtimeExceptions;
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
socket.close();
