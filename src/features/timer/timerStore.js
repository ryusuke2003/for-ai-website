import { registerTimerRuntime, tabGuardActions } from './tabGuard.js';

const DEFAULT_MINUTES = 25;
const TICK_INTERVAL_MS = 250;
const TIMER_STORAGE_KEY = 'one.timer.v1';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const listeners = new Set();
let timerId = null;

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function timerGuard() {
  return globalThis.ONE_TIMER_STATE_GUARD;
}

function validTimerMinutes(minutes) {
  const guard = timerGuard();
  const min = Number.isInteger(guard?.minMinutes) ? guard.minMinutes : 1;
  const max = Number.isInteger(guard?.maxMinutes) ? guard.maxMinutes : 180;
  return Number.isInteger(minutes) && minutes >= min && minutes <= max;
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(key) {
  if (typeof key !== 'string' || !DATE_KEY_PATTERN.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function readStoredTimerState() {
  try {
    const guard = timerGuard();
    const raw = localStorage.getItem(guard?.storageKey ?? TIMER_STORAGE_KEY);
    return guard?.parse?.(raw) ?? null;
  } catch {
    reportStorageFailure();
    return null;
  }
}

function storageShape(value) {
  return {
    selectedMinutes: value.selectedMinutes,
    remainingSeconds: value.remainingSeconds,
    running: value.running,
    endAt: value.running ? value.endAt : null,
    completionReady: value.completionReady,
    completionDate: value.completionReady ? value.completionDate : null,
  };
}

function persistTimerState(value) {
  const payload = JSON.stringify(storageShape(value));
  try {
    localStorage.setItem(timerGuard()?.storageKey ?? TIMER_STORAGE_KEY, payload);
    return true;
  } catch {
    reportStorageFailure();
    return false;
  }
}

function initialTimerState() {
  const stored = readStoredTimerState();
  const selectedMinutes = validTimerMinutes(stored?.selectedMinutes)
    ? stored.selectedMinutes
    : DEFAULT_MINUTES;
  const fullDuration = selectedMinutes * 60;
  const storedRemaining = stored?.remainingSeconds;
  let remainingSeconds = Number.isInteger(storedRemaining)
    && storedRemaining >= 0
    && storedRemaining <= fullDuration
    ? storedRemaining
    : fullDuration;

  const storedEndAt = stored?.endAt;
  if (stored?.running === true && Number.isSafeInteger(storedEndAt)) {
    const restoredRemaining = Math.ceil((storedEndAt - Date.now()) / 1000);
    if (restoredRemaining > 0 && restoredRemaining <= fullDuration) {
      return {
        selectedMinutes,
        remainingSeconds: restoredRemaining,
        running: true,
        endAt: storedEndAt,
        completionReady: false,
        completionDate: null,
        feedback: '集中中。再読み込み前の続きから再開しました。',
        feedbackState: 'running',
      };
    }

    if (restoredRemaining <= 0) {
      return {
        selectedMinutes,
        remainingSeconds: 0,
        running: false,
        endAt: null,
        completionReady: true,
        completionDate: dateKey(new Date(storedEndAt)),
        feedback: '前回の集中スプリントは完了しています。この1回を記録するか、記録せず破棄してください。',
        feedbackState: 'complete',
      };
    }
  }

  const partiallyElapsed = remainingSeconds > 0 && remainingSeconds < fullDuration;
  const completed = remainingSeconds === 0;
  const legacyCompletedState = completed && stored != null && typeof stored.completionReady !== 'boolean';
  const storedCompletionDate = isValidDateKey(stored?.completionDate) ? stored.completionDate : null;
  const completionReady = completed && (stored?.completionReady === true || legacyCompletedState);

  return {
    selectedMinutes,
    remainingSeconds,
    running: false,
    endAt: null,
    completionReady,
    completionDate: completionReady ? storedCompletionDate ?? dateKey() : null,
    feedback: partiallyElapsed
      ? '一時停止中。準備ができたら再開。'
      : completionReady
        ? '前回の集中スプリントは完了しています。この1回を記録するか、記録せず破棄してください。'
        : completed
          ? '前回の集中スプリントは記録済みです。もう一度始められます。'
          : '準備できたらスタート。',
    feedbackState: completed ? 'complete' : partiallyElapsed ? 'paused' : 'idle',
  };
}

let currentState = Object.freeze(initialTimerState());

function notify() {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('one:timer-state', {
    detail: currentState,
  }));
}

function replaceState(nextState, { persist = false } = {}) {
  currentState = Object.freeze(nextState);
  if (persist) persistTimerState(currentState);
  notify();
}

function clearTimerInterval() {
  if (timerId === null) return;
  window.clearInterval(timerId);
  timerId = null;
}

function finishTimer() {
  const completedOn = dateKey(new Date(currentState.endAt ?? Date.now()));
  clearTimerInterval();
  replaceState({
    ...currentState,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionReady: true,
    completionDate: completedOn,
    feedback: '集中スプリント完了。この1回を記録するか、記録せず破棄してください。',
    feedbackState: 'complete',
  }, { persist: true });
}

function tick() {
  if (!currentState.running || !Number.isFinite(currentState.endAt)) return;

  const remainingSeconds = Math.max(0, Math.ceil((currentState.endAt - Date.now()) / 1000));
  if (remainingSeconds === 0) {
    finishTimer();
    return;
  }

  if (remainingSeconds !== currentState.remainingSeconds) {
    replaceState({ ...currentState, remainingSeconds });
  }
}

function startTimer() {
  if (currentState.completionReady) return false;
  if (tabGuardActions.beforeStart(currentState) === false) return false;

  const remainingSeconds = currentState.remainingSeconds > 0
    ? currentState.remainingSeconds
    : currentState.selectedMinutes * 60;
  const endAt = Date.now() + remainingSeconds * 1000;

  clearTimerInterval();
  replaceState({
    ...currentState,
    remainingSeconds,
    running: true,
    endAt,
    completionReady: false,
    completionDate: null,
    feedback: '集中中。終了までこの時間に集中。',
    feedbackState: 'running',
  }, { persist: true });
  timerId = window.setInterval(tick, TICK_INTERVAL_MS);
  tick();
  return true;
}

function pauseTimer() {
  if (!currentState.running) return false;

  const remainingSeconds = Number.isFinite(currentState.endAt)
    ? Math.max(0, Math.ceil((currentState.endAt - Date.now()) / 1000))
    : currentState.remainingSeconds;
  if (remainingSeconds <= 0) {
    finishTimer();
    return true;
  }

  clearTimerInterval();
  replaceState({
    ...currentState,
    remainingSeconds,
    running: false,
    endAt: null,
    feedback: '一時停止中。準備ができたら再開。',
    feedbackState: 'paused',
  }, { persist: true });
  return true;
}

function resetToSelectedMinutes({ consumeCompletion = false } = {}) {
  if (currentState.completionReady && !consumeCompletion) return false;
  if (!consumeCompletion) tabGuardActions.beforeReset(currentState);

  clearTimerInterval();
  replaceState({
    ...currentState,
    remainingSeconds: currentState.selectedMinutes * 60,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
    feedback: `${currentState.selectedMinutes}分にリセットしました。`,
    feedbackState: 'idle',
  }, { persist: true });
  return true;
}

function selectMinutes(minutes, { focusStart = false } = {}) {
  if (!validTimerMinutes(minutes) || currentState.completionReady) return false;
  if (tabGuardActions.beforeSelectMinutes(currentState) === false) return false;

  clearTimerInterval();
  replaceState({
    ...currentState,
    selectedMinutes: minutes,
    remainingSeconds: minutes * 60,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
    feedback: `${minutes}分にリセットしました。`,
    feedbackState: 'idle',
  }, { persist: true });

  if (focusStart) {
    window.dispatchEvent(new CustomEvent('one:timer-controls-focus', {
      detail: { control: 'start' },
    }));
  }
  return true;
}

function syncIdleState(state) {
  if (!validTimerMinutes(state?.selectedMinutes)) return false;
  const fullDuration = state.selectedMinutes * 60;
  if (
    state.running === true
    || state.completionReady === true
    || state.remainingSeconds !== fullDuration
  ) {
    return false;
  }

  clearTimerInterval();
  replaceState({
    ...currentState,
    selectedMinutes: state.selectedMinutes,
    remainingSeconds: state.remainingSeconds,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
    feedback: `別のタブで${state.selectedMinutes}分に変更されました。`,
    feedbackState: 'idle',
  });
  window.dispatchEvent(new CustomEvent('one:idle-timer-sync', {
    detail: { selectedMinutes: state.selectedMinutes },
  }));
  return true;
}

function clearPendingCompletion(message, feedbackState = 'complete') {
  if (!currentState.completionReady) return false;
  replaceState({
    ...currentState,
    completionReady: false,
    completionDate: null,
    feedback: message,
    feedbackState,
  });
  return true;
}

function setFeedback(message, feedbackState = 'idle') {
  replaceState({
    ...currentState,
    feedback: message,
    feedbackState,
  });
}

function preparePrivacyReset() {
  clearTimerInterval();
  if (!currentState.running && currentState.endAt === null) return;
  replaceState({
    ...currentState,
    running: false,
    endAt: null,
  });
}

export function getTimerSnapshot() {
  return currentState;
}

export function subscribeTimer(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const timerActions = Object.freeze({
  toggle() {
    return currentState.running ? pauseTimer() : startTimer();
  },
  reset() {
    return resetToSelectedMinutes();
  },
  selectMinutes(minutes) {
    return selectMinutes(minutes);
  },
  applyCustomMinutes(minutes) {
    return selectMinutes(minutes, { focusStart: true });
  },
});

const timerRuntime = Object.freeze({
  snapshot: getTimerSnapshot,
  setFeedback,
  syncIdleState,
  clearPendingCompletion,
  consumeCompletion() {
    return resetToSelectedMinutes({ consumeCompletion: true });
  },
});

globalThis.ONE_TIMER_RUNTIME = timerRuntime;

if (currentState.running) {
  timerId = window.setInterval(tick, TICK_INTERVAL_MS);
}
persistTimerState(currentState);
registerTimerRuntime(timerRuntime);
window.addEventListener('one:privacy-reset-prepare', preparePrivacyReset);
notify();
