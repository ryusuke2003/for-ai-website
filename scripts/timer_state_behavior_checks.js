const assert = require('node:assert/strict');

async function main() {
  const { timerStateGuard: guard } = await import('../src/features/timer/timerStateGuard.js');

  assert.ok(guard, 'timerStateGuard must be available');
  assert.equal(guard.maxBytes, 10_000);
  assert.equal(guard.minMinutes, 1);
  assert.equal(guard.maxMinutes, 180);

  const currentState = {
    selectedMinutes: 25,
    remainingSeconds: 1500,
    running: true,
    endAt: Date.now() + 1_500_000,
    completionReady: false,
    completionDate: null,
  };
  assert.deepEqual(guard.parse(JSON.stringify(currentState)), currentState);

  const customDurationState = {
    selectedMinutes: 37,
    remainingSeconds: 37 * 60,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
  };
  assert.deepEqual(
    guard.parse(JSON.stringify(customDurationState)),
    customDurationState,
    'arbitrary supported durations remain part of the timer storage contract',
  );

  const boundaryDurations = [
    { selectedMinutes: 1, remainingSeconds: 60 },
    { selectedMinutes: 180, remainingSeconds: 180 * 60 },
  ];
  boundaryDurations.forEach(({ selectedMinutes, remainingSeconds }) => {
    const state = {
      selectedMinutes,
      remainingSeconds,
      running: false,
      endAt: null,
      completionReady: false,
      completionDate: null,
    };
    assert.deepEqual(guard.parse(JSON.stringify(state)), state);
  });

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
    { ...currentState, selectedMinutes: 0 },
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

  console.log('Timer state behavior checks passed, including 1-180 minute custom durations.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
