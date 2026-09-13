const TAB_SESSION_KEY = 'one.activeSession.v1';
const TAB_STORAGE_PROBE_KEY = 'one.tabStorageProbe.v1';
const SESSION_ID_PATTERN = /^[a-z0-9-]{8,80}$/;

let localSessionId = null;
let tabCoordinationEnabled = false;
let timerRuntime = null;
let timerRuntimeRegistered = false;

function disableTabCoordination() {
  tabCoordinationEnabled = false;
  localSessionId = null;
}

function storageCoordinationUnavailable() {
  if (storageAccessFailed) {
    disableTabCoordination();
    return true;
  }
  return !tabCoordinationEnabled;
}

function detectTabStorage() {
  try {
    localStorage.setItem(TAB_STORAGE_PROBE_KEY, '1');
    const persisted = localStorage.getItem(TAB_STORAGE_PROBE_KEY) === '1';
    if (!persisted) {
      reportStorageFailure();
      return false;
    }

    localStorage.removeItem(TAB_STORAGE_PROBE_KEY);
    if (localStorage.getItem(TAB_STORAGE_PROBE_KEY) !== null) {
      reportStorageFailure();
      return false;
    }
    return true;
  } catch {
    // Report below so the app-wide storage status changes too.
  }

  reportStorageFailure();
  return false;
}

function readStoredSessionId() {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return null;
  const value = safeRead(TAB_SESSION_KEY);
  if (storageCoordinationUnavailable()) return null;
  return SESSION_ID_PATTERN.test(value) ? value : null;
}

function writeStoredSessionId(value) {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable() || !SESSION_ID_PATTERN.test(value)) return;
  if (!safeWrite(TAB_SESSION_KEY, value)) disableTabCoordination();
}

function clearStoredSessionId() {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return;

  try {
    localStorage.removeItem(TAB_SESSION_KEY);
    if (localStorage.getItem(TAB_SESSION_KEY) === null) return;
  } catch {
    // Report below and keep the app usable without cross-tab coordination.
  }

  reportStorageFailure();
  disableTabCoordination();
}

function createSessionId() {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
    disableTabCoordination();
    return null;
  }

  try {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    disableTabCoordination();
    return null;
  }
}

function ensureStoredSessionId() {
  const existing = readStoredSessionId();
  if (existing) return existing;

  const candidate = createSessionId();
  if (!candidate) return null;
  writeStoredSessionId(candidate);
  if (storageCoordinationUnavailable()) return candidate;
  return readStoredSessionId() ?? candidate;
}

function timerSnapshot() {
  return timerRuntime?.snapshot?.() ?? null;
}

function isTimerStateActive(state) {
  const minutes = state?.selectedMinutes;
  const remaining = state?.remainingSeconds;
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES) return false;

  const fullDuration = minutes * 60;
  return state?.running === true
    || state?.completionReady === true
    || (Number.isInteger(remaining) && remaining > 0 && remaining < fullDuration);
}

function hasLocalTimerContext() {
  return isTimerStateActive(timerSnapshot());
}

function parseIdleTimerState(raw) {
  const state = globalThis.ONE_TIMER_STATE_GUARD?.parse(raw) ?? null;
  if (!state) return null;

  const fullDuration = state.selectedMinutes * 60;
  if (
    state.running === true
    || state.completionReady === true
    || state.remainingSeconds !== fullDuration
  ) {
    return null;
  }

  return state;
}

function syncIdleTimerFromStorage(raw) {
  if (!timerRuntime || storageCoordinationUnavailable() || hasLocalTimerContext()) return false;

  const state = parseIdleTimerState(raw);
  if (!state) return false;

  localSessionId = null;
  return timerRuntime.syncIdleState?.(state) === true;
}

function refreshGuardProgressFromStorage() {
  if (storageCoordinationUnavailable()) return false;

  const storedDoneCount = readDoneCount();
  const storedHistory = readHistory();
  if (storageCoordinationUnavailable()) return false;

  doneCount.textContent = String(storedDoneCount);
  focusHistory = storedHistory;
  renderHistory();
  return true;
}

function setCrossTabFeedback(message, state = 'idle') {
  timerRuntime?.setFeedback?.(message, state);
}

function blockStaleTabAction(message) {
  if (!refreshGuardProgressFromStorage()) return false;
  timerRuntime?.clearPendingCompletion?.(message, 'complete');
  return true;
}

function claimPendingCompletion() {
  const current = timerSnapshot();
  if (!current?.completionReady) return false;
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return true;

  if (!localSessionId) {
    return !blockStaleTabAction(
      'このタブでは集中セッションを確認できません。再読み込みして最新状態に合わせてください。',
    );
  }

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable()) return true;

  const storedRemaining = storedState?.remainingSeconds;
  const stillPending = storedState?.completionReady === true
    && storedRemaining === 0
    && storedSessionId === localSessionId;

  if (!stillPending) {
    const blocked = blockStaleTabAction(
      'この集中は別のタブですでに処理されています。最新の記録を反映しました。',
    );
    if (blocked) localSessionId = null;
    return !blocked;
  }

  clearStoredSessionId();
  localSessionId = null;
  if (storageCoordinationUnavailable()) return true;
  refreshGuardProgressFromStorage();
  return true;
}

function verifyCompletionConsumedState() {
  if (storageAccessFailed) return false;

  const current = timerSnapshot();
  const storedState = readTimerState();
  if (storageAccessFailed || !current) return false;

  const fullDuration = current.selectedMinutes * 60;
  const persisted = storedState?.selectedMinutes === current.selectedMinutes
    && storedState?.remainingSeconds === fullDuration
    && storedState?.running === false
    && storedState?.endAt === null
    && storedState?.completionReady === false
    && storedState?.completionDate === null;

  if (persisted) return true;
  reportStorageFailure();
  return false;
}

function persistDoneCountAtLeast(expectedCount) {
  if (!safeWrite(STORAGE_KEYS.count, String(expectedCount))) return false;

  const storedCount = readDoneCount();
  if (storageAccessFailed) return false;
  if (storedCount >= expectedCount) return true;

  reportStorageFailure();
  return false;
}

function persistHistoryEntryAtLeast(historyKey, expectedCount) {
  if (!safeWrite(STORAGE_KEYS.history, JSON.stringify(focusHistory))) return false;

  const storedHistory = readHistory();
  if (storageAccessFailed) return false;
  if ((storedHistory[historyKey] ?? 0) >= expectedCount) return true;

  reportStorageFailure();
  return false;
}

function focusStartControl() {
  window.dispatchEvent(new CustomEvent('one:timer-controls-focus', {
    detail: { control: 'start' },
  }));
}

function recordPendingCompletion() {
  const before = timerSnapshot();
  if (!before?.completionReady || !claimPendingCompletion()) return false;

  const completedOn = before.completionDate;
  const current = parseDoneCount(doneCount.textContent);
  const next = Math.min(current + 1, Number.MAX_SAFE_INTEGER);

  const consumedLocally = timerRuntime?.consumeCompletion?.() === true;
  const completionConsumed = consumedLocally && verifyCompletionConsumedState();

  doneCount.textContent = String(next);
  const historyUpdate = incrementFocusHistoryInMemory(completedOn);

  let countPersisted = false;
  let historyPersisted = false;
  if (completionConsumed && !storageAccessFailed) {
    countPersisted = persistDoneCountAtLeast(next);
    if (countPersisted && !storageAccessFailed) {
      historyPersisted = persistHistoryEntryAtLeast(
        historyUpdate.historyKey,
        historyUpdate.expectedCount,
      );
    }
  }

  if (completionConsumed && countPersisted && historyPersisted) {
    setCrossTabFeedback(
      completedOn && completedOn !== dateKey()
        ? `${completedOn}に完了した集中を1回記録しました。`
        : '完了した集中を1回記録しました。次のスプリントを始められます。',
    );
  } else {
    setCrossTabFeedback(
      'このタブでは集中を1回記録しましたが、端末保存を最後まで確認できませんでした。再読み込みせず「JSONを書き出す」で現在の記録を救出してください。',
      'complete',
    );
  }

  focusStartControl();
  return true;
}

function discardPendingCompletion() {
  const before = timerSnapshot();
  if (!before?.completionReady || !claimPendingCompletion()) return false;

  const discardedOn = before.completionDate;
  const consumedLocally = timerRuntime?.consumeCompletion?.() === true;
  const completionConsumed = consumedLocally && verifyCompletionConsumedState();

  setCrossTabFeedback(
    completionConsumed
      ? discardedOn && discardedOn !== dateKey()
        ? `${discardedOn}に完了した集中を記録せず破棄しました。`
        : '完了した集中を記録せず破棄しました。次のスプリントを始められます。'
      : 'このタブでは完了した集中を破棄しましたが、端末保存を確認できませんでした。再読み込みすると未処理の完了として戻る可能性があります。',
    completionConsumed ? 'idle' : 'complete',
  );

  focusStartControl();
  return true;
}

function blockIfAnotherTabOwnsTimer() {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return false;

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable()) return false;
  if (!isTimerStateActive(storedState) || !storedSessionId) return false;
  if (localSessionId === storedSessionId) return false;

  setCrossTabFeedback(
    '別のタブで集中タイマーが進行中です。そのタブで続けるか、再読み込みして状態を合わせてください。',
  );
  return true;
}

function blockIfLocalSessionIsStale() {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return false;

  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable()) return false;
  if (localSessionId && storedSessionId === localSessionId) return false;

  setCrossTabFeedback(
    'このタブのタイマー状態は別のタブで変更されています。再読み込みして最新状態に合わせてください。',
  );
  localSessionId = null;
  return true;
}

function beforeStart(state) {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return true;
  if (blockIfAnotherTabOwnsTimer()) return false;

  const fullDuration = state.selectedMinutes * 60;
  const resuming = state.remainingSeconds > 0 && state.remainingSeconds < fullDuration;
  if (resuming) return !blockIfLocalSessionIsStale();

  localSessionId = createSessionId();
  if (!localSessionId) return true;
  writeStoredSessionId(localSessionId);
  return true;
}

function beforeReset(state) {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable() || state?.completionReady) return true;
  localSessionId = null;
  clearStoredSessionId();
  return true;
}

function beforeSelectMinutes(state) {
  return beforeReset(state);
}

function initializeTabGuard() {
  tabCoordinationEnabled = detectTabStorage();
  if (!tabCoordinationEnabled) return;

  if (hasLocalTimerContext()) {
    localSessionId = ensureStoredSessionId();
    return;
  }

  clearStoredSessionId();
}

function registerTimerRuntime(runtime) {
  if (timerRuntimeRegistered) return false;
  if (!runtime || typeof runtime.snapshot !== 'function') return false;

  timerRuntime = runtime;
  timerRuntimeRegistered = true;
  initializeTabGuard();
  return true;
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.timer) {
    syncIdleTimerFromStorage(event.newValue);
    return;
  }

  const current = timerSnapshot();
  if (
    !tabCoordinationEnabled
    || storageCoordinationUnavailable()
    || event.key !== TAB_SESSION_KEY
    || !current?.completionReady
    || !localSessionId
  ) {
    return;
  }

  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable() || storedSessionId === localSessionId) return;
  if (!refreshGuardProgressFromStorage()) return;

  timerRuntime?.clearPendingCompletion?.(
    'この集中は別のタブで処理されました。最新の記録を反映しました。',
    'complete',
  );
  localSessionId = null;
});

window.addEventListener('one:storage-error', disableTabCoordination);

globalThis.ONE_TAB_GUARD = Object.freeze({
  registerTimerRuntime,
  beforeStart,
  beforeReset,
  beforeSelectMinutes,
  recordPendingCompletion,
  discardPendingCompletion,
});

globalThis.ONE_TAB_COORDINATION = Object.freeze({
  isEnabled() {
    return tabCoordinationEnabled && !storageAccessFailed;
  },
  hasActiveStoredTimer() {
    if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return false;
    const storedState = readTimerState();
    const storedSessionId = readStoredSessionId();
    if (storageCoordinationUnavailable()) return false;
    return Boolean(storedSessionId && isTimerStateActive(storedState));
  },
});
