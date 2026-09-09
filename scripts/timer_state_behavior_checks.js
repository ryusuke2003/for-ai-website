const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

require('../timer-bootstrap.js');

const guard = globalThis.ONE_TIMER_STATE_GUARD;
assert.ok(guard, 'ONE_TIMER_STATE_GUARD must be available');
assert.equal(guard.maxBytes, 10_000);

const currentState = {
  selectedMinutes: 25,
  remainingSeconds: 1500,
  running: true,
  endAt: Date.now() + 1_500_000,
  completionReady: false,
  completionDate: null,
};
assert.deepEqual(guard.parse(JSON.stringify(currentState)), currentState);

const legacyCompletedState = {
  selectedMinutes: 25,
  remainingSeconds: 0,
  running: false,
  endAt: null,
};
assert.deepEqual(guard.parse(JSON.stringify(legacyCompletedState)), legacyCompletedState);

const legacyPendingCompletion = {
  ...legacyCompletedState,
  completionReady: true,
};
assert.deepEqual(
  guard.parse(JSON.stringify(legacyPendingCompletion)),
  legacyPendingCompletion,
  'legacy pending completion without completionDate remains readable',
);

const withUnknownKey = guard.parse(JSON.stringify({ ...legacyCompletedState, futureField: 'ignored' }));
assert.deepEqual(withUnknownKey, legacyCompletedState);

const invalidStates = [
  { ...currentState, selectedMinutes: '25' },
  { ...currentState, selectedMinutes: 181 },
  { ...currentState, remainingSeconds: '1500' },
  { ...currentState, remainingSeconds: 1501 },
  { ...currentState, running: 'true' },
  { ...currentState, endAt: null },
  { ...currentState, remainingSeconds: 0 },
  { ...currentState, completionReady: true },
  {
    selectedMinutes: 25,
    remainingSeconds: 120,
    running: false,
    endAt: null,
    completionReady: true,
    completionDate: '2026-09-07',
  },
  {
    selectedMinutes: 25,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: '2026-09-07',
  },
  {
    selectedMinutes: 25,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionDate: '2026-09-07',
  },
  {
    selectedMinutes: 25,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionReady: true,
    completionDate: '2026-02-30',
  },
];

invalidStates.forEach((state) => {
  assert.equal(guard.parse(JSON.stringify(state)), null, `invalid state was accepted: ${JSON.stringify(state)}`);
});

assert.equal(guard.parse('{not-json'), null);
assert.equal(guard.parse(''), null);
assert.equal(guard.parse('x'.repeat(guard.maxBytes + 1)), null);

// Execute the complete custom-timer script with a small UI boundary. This catches
// missing shared globals that syntax checks and the state parser alone cannot see.
function makeControl(id, minutes) {
  return {
    id,
    value: '',
    disabled: false,
    dataset: minutes === undefined ? {} : { minutes: String(minutes) },
    classList: { toggle() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
  };
}

const controls = new Map();
const customControl = makeControl('custom-preset', 25);
controls.set('#custom-preset', customControl);
const presets = [10, 25, 50].map((minutes) => makeControl(`preset-${minutes}`, minutes));
presets.push(customControl);
const context = vm.createContext({
  document: {
    querySelector(selector) {
      if (!controls.has(selector)) controls.set(selector, makeControl(selector));
      return controls.get(selector);
    },
  },
  window: { addEventListener() {} },
  MutationObserver: class { observe() {} },
  presetButtons: presets,
  selectedMinutes: 25,
  remainingSeconds: 1500,
  timerId: null,
  endAt: null,
  completionReady: false,
  formatTime: () => '25:00',
  renderTimer() {},
  applyBackup(restored) {
    context.selectedMinutes = restored.selectedMinutes;
  },
  refreshRecoveryAvailability() {},
});

for (const filename of ['timer-bootstrap.js', 'custom-timer.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, '..', filename), 'utf8'), context, { filename });
}

for (const minutes of [1, 25, 37, 180]) {
  assert.equal(context.isAllowedCustomTimerMinutes(minutes), true);
  controls.get('#custom-minutes').value = String(minutes);
  assert.equal(context.parseCustomTimerMinutes(), minutes);
}
for (const minutes of [0, 181, 1.5, '25', NaN, Infinity]) {
  assert.equal(context.isAllowedCustomTimerMinutes(minutes), false);
}
for (const input of ['', '0', '181', '1.5', '1e2', '-1']) {
  controls.get('#custom-minutes').value = input;
  assert.equal(context.parseCustomTimerMinutes(), null);
}

const backupMinutes = Array.from(context.availablePresetMinutes());
assert.deepEqual(backupMinutes, Array.from({ length: 180 }, (_, index) => index + 1));
context.applyBackup({ selectedMinutes: 37 });
assert.equal(customControl.dataset.minutes, '37');
assert.equal(controls.get('#custom-minutes').value, '37');

console.log('Timer state and custom timer behavior checks passed.');
