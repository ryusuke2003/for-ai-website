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
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${timePart}-${randomPart}`;
}

function ensureStoredSessionId() {
  const existing = readStoredSessionId();
  if (existing) return existing;

  const candidate = createSessionId();
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

function refreshProgressFromStorage() {
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
  if (!refreshProgressFromStorage()) return false;
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
  refreshProgressFromStorage();
  return true;
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

doneButton.addEventListener('click', (event) => {
  if (completionReady) claimPendingCompletion(event);
}, true);

discardButton.addEventListener('click', (event) => {
  if (completionReady) claimPendingCompletion(event);
}, true);

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.count || event.key === STORAGE_KEYS.history) {
    refreshProgressFromStorage();
    return;
  }

  if (!tabCoordinationEnabled || storageCoordinationUnavailable() || event.key !== TAB_SESSION_KEY || !completionReady || !localSessionId) return;
  const storedSessionId = readStoredSessionId();
  if (storageCoordinationUnavailable() || storedSessionId === localSessionId) return;
  if (!refreshProgressFromStorage()) return;

  setRecordAvailability(false);
  setTimerFeedback('この集中は別のタブで処理されました。最新の記録を反映しました。', 'complete');
  localSessionId = null;
});

window.addEventListener('one:storage-error', disableTabCoordination);

initializeTabGuard();