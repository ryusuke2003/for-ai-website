// Temporary compatibility layer between legacy timer globals and React.
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

window.addEventListener('one:privacy-reset-prepare', () => {
  clearTimerInterval();
  endAt = null;
});

if (document.documentElement.dataset.reactTimerControls === '1') {
  const legacyCustomPreset = presetButtons.find((button) => button.id === 'custom-preset') ?? null;
  const legacyQuickPresets = presetButtons.filter((button) => button.id !== 'custom-preset');

  function forwardDetachedFocus(button, control) {
    const nativeFocus = button.focus.bind(button);
    button.focus = (options) => {
      if (button.isConnected) {
        nativeFocus(options);
        return;
      }

      window.dispatchEvent(new CustomEvent('one:timer-controls-focus', {
        detail: { control },
      }));
    };
  }

  function validTimerMinutes(minutes) {
    const guard = globalThis.ONE_TIMER_STATE_GUARD;
    return Number.isInteger(minutes)
      && minutes >= (guard?.minMinutes ?? 1)
      && minutes <= (guard?.maxMinutes ?? MAX_MINUTES);
  }

  function selectTimerMinutes(minutes, { focusStart = false } = {}) {
    if (!validTimerMinutes(minutes) || completionReady) return false;

    let target = legacyQuickPresets.find(
      (button) => Number.parseInt(button.dataset.minutes, 10) === minutes,
    );
    if (!target && legacyCustomPreset) {
      legacyCustomPreset.dataset.minutes = String(minutes);
      target = legacyCustomPreset;
    }
    if (!target) return false;

    target.click();
    if (focusStart) startButton.focus();
    return true;
  }

  forwardDetachedFocus(startButton, 'start');

  globalThis.ONE_REACT_TIMER_CONTROLS = Object.freeze({
    start() {
      startButton.click();
    },
    reset() {
      resetButton.click();
    },
    selectMinutes(minutes) {
      return selectTimerMinutes(minutes);
    },
    applyCustomMinutes(minutes) {
      return selectTimerMinutes(minutes, { focusStart: true });
    },
  });
}
