if (document.documentElement.dataset.reactTimerState === '1') {
  let currentSnapshot = null;
  let lastSerializedSnapshot = '';
  let publishQueued = false;

  function buildTimerStateSnapshot() {
    return {
      selectedMinutes,
      remainingSeconds,
      running: timerId !== null && Number.isFinite(endAt),
      endAt: timerId !== null && Number.isFinite(endAt) ? endAt : null,
      completionReady,
      completionDate: completionReady ? completionDateKey : null,
      focusMode: document.body.classList.contains('focus-mode'),
      feedback: timerStatus.textContent ?? '準備できたらスタート。',
      feedbackState: timerCard.classList.contains('is-complete')
        ? 'complete'
        : timerCard.classList.contains('is-running')
          ? 'running'
          : 'idle',
    };
  }

  function dispatchTimerState() {
    publishQueued = false;
    window.dispatchEvent(new CustomEvent('one:timer-state', {
      detail: currentSnapshot,
    }));
  }

  function refreshTimerState({ force = false } = {}) {
    const nextSnapshot = buildTimerStateSnapshot();
    const serialized = JSON.stringify(nextSnapshot);
    if (!force && serialized === lastSerializedSnapshot) return;

    lastSerializedSnapshot = serialized;
    currentSnapshot = Object.freeze(nextSnapshot);
    if (publishQueued) return;

    publishQueued = true;
    queueMicrotask(dispatchTimerState);
  }

  function wrapStateMutation(name) {
    const original = globalThis[name];
    if (typeof original !== 'function') return;

    globalThis[name] = function timerStateAwareMutation(...args) {
      const result = original.apply(this, args);
      refreshTimerState();
      return result;
    };
  }

  for (const functionName of [
    'setTimerFeedback',
    'setRecordAvailability',
    'renderTimer',
    'setStartButton',
    'setFocusMode',
  ]) {
    wrapStateMutation(functionName);
  }

  globalThis.ONE_REACT_TIMER_STATE = Object.freeze({
    snapshot() {
      return currentSnapshot;
    },
  });

  refreshTimerState({ force: true });
}
