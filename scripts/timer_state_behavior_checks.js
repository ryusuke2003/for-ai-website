const assert = require('node:assert/strict');

require('../timer-state.js');

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

console.log('Timer state behavior checks passed.');
