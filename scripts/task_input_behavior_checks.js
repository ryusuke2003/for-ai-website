const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the real scripts in their page order. Only browser/DOM boundaries are
// simulated so the beforeinput and window-focus handlers run together with sync.
function createPage({ taskDate = '2026-09-08', timerState = null } = {}) {
  let now = new Date('2026-09-08T12:00:00').getTime();
  let failReads = false;
  const saved = new Map([
    ['one.task', 'ローカルの下書き'],
    ['one.taskDate.v1', taskDate],
  ]);
  if (timerState) saved.set('one.timer.v1', JSON.stringify(timerState));

  function eventTarget() {
    const listeners = new Map();
    return {
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      dispatchEvent(event) {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
      },
    };
  }

  function element() {
    const attributes = new Map();
    const classes = new Set();
    return {
      ...eventTarget(),
      value: '', textContent: '', dataset: {}, maxLength: 120,
      classList: {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); },
        toggle(value, enabled) {
          if (enabled) classes.add(value);
          else classes.delete(value);
        },
      },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      removeAttribute(name) { attributes.delete(name); },
      append() {}, replaceChildren() {}, after() {},
      focus() { document.activeElement = this; },
    };
  }

  const controls = new Map();
  const presets = [10, 25, 50].map((minutes) => {
    const control = element();
    control.dataset.minutes = String(minutes);
    return control;
  });
  const document = {
    ...eventTarget(), activeElement: null, visibilityState: 'visible', body: element(),
    querySelector(selector) {
      if (!controls.has(selector)) controls.set(selector, element());
      return controls.get(selector);
    },
    querySelectorAll() { return presets; },
    createElement: element,
  };
  const window = {
    ...eventTarget(), setInterval() { return 1; }, clearInterval() {},
  };
  const context = vm.createContext({
    document, window,
    Event: class { constructor(type) { this.type = type; } },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    localStorage: {
      getItem(key) {
        if (failReads) throw new Error('Simulated storage failure');
        return saved.get(key) ?? null;
      },
      setItem(key, value) { saved.set(key, String(value)); },
      removeItem(key) { saved.delete(key); },
    },
  });
  for (const filename of ['timer-bootstrap.js', 'app.js', 'storage-status.js']) {
    vm.runInContext(readFileSync(path.join(__dirname, '..', filename), 'utf8'), context, { filename });
  }

  return {
    context, document, window, saved,
    input: controls.get('#task-input'),
    setTime(value) { now = new Date(value).getTime(); },
    failStorageReads() { failReads = true; },
    updateRemoteTask(value, { notify = true } = {}) {
      saved.set('one.task', value);
      if (notify) window.dispatchEvent({ type: 'storage', key: 'one.task', newValue: value });
    },
  };
}

const editing = createPage();
assert.equal(editing.input.value, 'ローカルの下書き', 'initial loading restores the saved task');
editing.document.activeElement = editing.input;
editing.updateRemoteTask('別タブのタスク');
assert.equal(editing.input.value, 'ローカルの下書き', 'storage sync preserves an active editor');
editing.input.dispatchEvent({ type: 'beforeinput' });
assert.equal(editing.input.value, 'ローカルの下書き', 'beforeinput must not replace the protected draft');
editing.window.dispatchEvent({ type: 'focus' });
assert.equal(editing.input.value, 'ローカルの下書き', 'window focus must not replace the protected draft');
assert.equal(editing.saved.get('one.task'), '別タブのタスク', 'refresh must not write the draft over a remote update');
editing.input.value += '!';
editing.input.dispatchEvent({ type: 'input' });
assert.equal(editing.saved.get('one.task'), 'ローカルの下書き!', 'explicit editing saves the local draft');

const idle = createPage();
idle.updateRemoteTask('別タブのタスク');
assert.equal(idle.input.value, '別タブのタスク', 'idle tabs still receive storage updates');
idle.updateRemoteTask('復帰時の最新版', { notify: false });
idle.window.dispatchEvent({ type: 'focus' });
assert.equal(idle.input.value, '復帰時の最新版', 'idle window focus refreshes missed updates');

for (const state of ['running', 'paused', 'completed']) {
  const page = createPage();
  page.context.startTimer();
  page.setTime('2026-09-08T12:01:00');
  if (state === 'paused') page.context.toggleTimer();
  if (state === 'completed') {
    vm.runInContext('endAt = Date.now(); tick();', page.context);
  }
  page.updateRemoteTask('別タブのタスク');
  page.window.dispatchEvent({ type: 'focus' });
  assert.equal(page.input.value, 'ローカルの下書き', `${state} session keeps its task on window focus`);
  page.setTime('2026-09-09T00:01:00');
  page.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(page.input.value, 'ローカルの下書き', `${state} session keeps its task after midnight`);
}

const restored = createPage({
  taskDate: '2026-09-07',
  timerState: { selectedMinutes: 25, remainingSeconds: 120, running: false, endAt: null },
});
assert.equal(restored.input.value, 'ローカルの下書き', 'startup still restores a previous-day active session');

const nextDay = createPage();
nextDay.document.activeElement = nextDay.input;
nextDay.setTime('2026-09-09T00:01:00');
nextDay.input.dispatchEvent({ type: 'beforeinput' });
assert.equal(nextDay.input.value, '', 'an idle previous-day task clears before typing');
assert.equal(nextDay.saved.get('one.taskDate.v1'), '2026-09-09');

const unavailable = createPage();
unavailable.document.activeElement = unavailable.input;
unavailable.failStorageReads();
unavailable.input.dispatchEvent({ type: 'beforeinput' });
assert.equal(unavailable.input.value, 'ローカルの下書き', 'storage read failure keeps the draft');
assert.equal(vm.runInContext('storageAccessFailed', unavailable.context), true);

console.log('Task input, active session and day rollover behavior checks passed.');
