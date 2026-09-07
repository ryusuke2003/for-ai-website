const TAB_SESSION_KEY = 'one.activeSession.v1';
const TAB_STORAGE_PROBE_KEY = 'one.tabStorageProbe.v1';
const SESSION_ID_PATTERN = /^[a-z0-9-]{8,80}$/;

let localSessionId = null;
let tabCoordinationEnabled = false;

function disableTabCoordination() {
  tabCoordinationEnabled = false;
  localSessionId = null;
}

function storageCoordinationUnavailable() {
  if (!storageAccessFailed) return false;
  disableTabCoordination();
  return true;
}

function detectTabStorage() {
  try {
    localStorage.setItem(TAB_STORAGE_PROBE_KEY, '1');
    const persisted = localStorage.getItem(TAB_STORAGE_PROBE_KEY) === '1';
    localStorage.removeItem(TAB_STORAGE_PROBE_KEY);
    if (persisted) return true;
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
  const fullDuration = selectedMinutes * 60;
  return timerId !== null
    || completionReady
    || (remainingSeconds > 0 && remainingSeconds < fullDuration);
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
  if (storageCoordinationUnavailable() || hasLocalTimerContext()) return false;

  const state = parseIdleTimerState(raw);
  if (!state) return false;

  selectedMinutes = state.selectedMinutes;
  remainingSeconds = state.remainingSeconds;
  endAt = null;
  localSessionId = null;
  setRecordAvailability(false);

  presetButtons.forEach((button) => {
    const active = button.id !== 'custom-preset'
      && Number.parseInt(button.dataset.minutes, 10) === selectedMinutes;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  renderTimer();
  setTimerFeedback(`別のタブで${selectedMinutes}分に変更されました。`, 'idle');
  window.dispatchEvent(new CustomEvent('one:idle-timer-sync', {
    detail: { selectedMinutes },
  }));
  return true;
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

function stopCrossTabAction(event, message, state = 'idle') {
  event.preventDefault();
  event.stopImmediatePropagation();
  setTimerFeedback(message, state);
}

function blockStaleTabAction(event, message) {
  if (!refreshGuardProgressFromStorage()) return false;
  stopCrossTabAction(event, message, 'complete');
  setRecordAvailability(false);
  return true;
}

function claimPendingCompletion(event) {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return true;
  if (!completionReady) return false;
  if (!localSessionId) {
    return !blockStaleTabAction(
      event,
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
      event,
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

  const storedState = readTimerState();
  if (storageAccessFailed) return false;

  const fullDuration = selectedMinutes * 60;
  const persisted = storedState?.selectedMinutes === selectedMinutes
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

function incrementFocusHistoryInMemory(key = dateKey()) {
  const historyKey = isValidDateKey(key) ? key : dateKey();
  const current = Number.isInteger(focusHistory[historyKey]) ? focusHistory[historyKey] : 0;
  const next = Math.min(current + 1, MAX_DAILY_COUNT);
  focusHistory[historyKey] = next;
  focusHistory = normalizeHistory(focusHistory);
  renderHistory();
  return { historyKey, expectedCount: focusHistory[historyKey] ?? next };
}

function persistHistoryEntryAtLeast(historyKey, expectedCount) {
  if (!safeWrite(STORAGE_KEYS.history, JSON.stringify(focusHistory))) return false;

  const storedHistory = readHistory();
  if (storageAccessFailed) return false;
  if ((storedHistory[historyKey] ?? 0) >= expectedCount) return true;

  reportStorageFailure();
  return false;
}

function refreshRecoveryAfterCompletionAction() {
  if (typeof refreshRecoveryAvailability === 'function') refreshRecoveryAvailability();
}

function recordPendingCompletion(event) {
  if (!completionReady || !claimPendingCompletion(event)) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const completedOn = completionDateKey;
  const current = parseDoneCount(doneCount.textContent);
  const next = Math.min(current + 1, Number.MAX_SAFE_INTEGER);

  resetTimer();
  const completionConsumed = verifyCompletionConsumedState();

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
    setTimerFeedback(
      completedOn && completedOn !== dateKey()
        ? `${completedOn}に完了した集中を1回記録しました。`
        : '完了した集中を1回記録しました。次のスプリントを始められます。',
    );
  } else {
    setTimerFeedback(
      'このタブでは集中を1回記録しましたが、端末保存を最後まで確認できませんでした。再読み込みせず「JSONを書き出す」で現在の記録を救出してください。',
      'complete',
    );
  }

  refreshRecoveryAfterCompletionAction();
  startButton.focus();
}

function discardPendingCompletion(event) {
  if (!completionReady || !claimPendingCompletion(event)) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const discardedOn = completionDateKey;
  resetTimer();
  const completionConsumed = verifyCompletionConsumedState();

  setTimerFeedback(
    completionConsumed
      ? discardedOn && discardedOn !== dateKey()
        ? `${discardedOn}に完了した集中を記録せず破棄しました。`
        : '完了した集中を記録せず破棄しました。次のスプリントを始められます。'
      : 'このタブでは完了した集中を破棄しましたが、端末保存を確認できませんでした。再読み込みすると未処理の完了として戻る可能性があります。',
    completionConsumed ? 'idle' : 'complete',
  );

  refreshRecoveryAfterCompletionAction();
  startButton.focus();
}

function blockIfAnotherTabOwnsTimer(event) {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return false;

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable()) return false;
  if (!isTimerStateActive(storedState) || !storedSessionId) return false;
  if (localSessionId === storedSessionId) return false;

  stopCrossTabAction(
    event,
    '別のタブで集中タイマーが進行中です。そのタブで続けるか、再読み込みして状態を合わせてください。',
  );
  return true;
}

function blockIfLocalSessionIsStale(event) {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return false;

  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable()) return false;
  if (localSessionId && storedSessionId === localSessionId) return false;

  stopCrossTabAction(
    event,
    'このタブのタイマー状態は別のタブで変更されています。再読み込みして最新状態に合わせてください。',
  );
  localSessionId = null;
  return true;
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

startButton.addEventListener('click', (event) => {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable() || timerId !== null || completionReady) return;
  if (blockIfAnotherTabOwnsTimer(event)) return;

  const fullDuration = selectedMinutes * 60;
  const resuming = remainingSeconds > 0 && remainingSeconds < fullDuration;
  if (resuming) {
    if (blockIfLocalSessionIsStale(event)) return;
    return;
  }

  localSessionId = createSessionId();
  if (!localSessionId) return;
  writeStoredSessionId(localSessionId);
}, true);

resetButton.addEventListener('click', () => {
  if (!tabCoordinationEnabled || storageCoordinationUnavailable() || completionReady) return;
  localSessionId = null;
  clearStoredSessionId();
}, true);

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!tabCoordinationEnabled || storageCoordinationUnavailable() || completionReady) return;
    localSessionId = null;
    clearStoredSessionId();
  }, true);
});

doneButton.addEventListener('click', recordPendingCompletion, true);
discardButton.addEventListener('click', discardPendingCompletion, true);

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.timer) {
    syncIdleTimerFromStorage(event.newValue);
    return;
  }

  if (!tabCoordinationEnabled || storageCoordinationUnavailable() || event.key !== TAB_SESSION_KEY || !completionReady || !localSessionId) return;
  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable() || storedSessionId === localSessionId) return;
  if (!refreshGuardProgressFromStorage()) return;

  setRecordAvailability(false);
  setTimerFeedback('この集中は別のタブで処理されました。最新の記録を反映しました。', 'complete');
  localSessionId = null;
});

window.addEventListener('one:storage-error', disableTabCoordination);

initializeTabGuard();