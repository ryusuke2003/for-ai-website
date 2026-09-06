const TAB_SESSION_KEY = 'one.activeSession.v1';
const SESSION_ID_PATTERN = /^[a-z0-9-]{8,80}$/;

let localSessionId = null;

function readStoredSessionId() {
  const value = safeRead(TAB_SESSION_KEY);
  return SESSION_ID_PATTERN.test(value) ? value : null;
}

function writeStoredSessionId(value) {
  if (!SESSION_ID_PATTERN.test(value)) return;
  safeWrite(TAB_SESSION_KEY, value);
}

function clearStoredSessionId() {
  try {
    localStorage.removeItem(TAB_SESSION_KEY);
  } catch {
    // Storage can be unavailable; the app still works without cross-tab coordination.
  }
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
  return readStoredSessionId() ?? candidate;
}

function isTimerStateActive(state) {
  const minutes = Number.parseInt(state?.selectedMinutes, 10);
  const remaining = Number.parseInt(state?.remainingSeconds, 10);
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
  const count = Number.parseInt(safeRead(STORAGE_KEYS.count, '0'), 10);
  doneCount.textContent = String(Number.isSafeInteger(count) && count >= 0 ? count : 0);
  focusHistory = readHistory();
  renderHistory();
}

function blockStaleTabAction(event, message) {
  event.preventDefault();
  event.stopImmediatePropagation();
  refreshProgressFromStorage();
  setRecordAvailability(false);
  setTimerFeedback(message, 'complete');
}

function claimPendingCompletion(event) {
  if (!completionReady || !localSessionId) return false;

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  const storedRemaining = Number.parseInt(storedState?.remainingSeconds, 10);
  const stillPending = storedState?.completionReady === true
    && storedRemaining === 0
    && storedSessionId === localSessionId;

  if (!stillPending) {
    blockStaleTabAction(event, 'この集中は別のタブですでに処理されています。最新の記録を反映しました。');
    localSessionId = null;
    return false;
  }

  clearStoredSessionId();
  localSessionId = null;
  refreshProgressFromStorage();
  return true;
}

function blockIfAnotherTabOwnsTimer(event) {
  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  if (!isTimerStateActive(storedState) || !storedSessionId) return false;
  if (localSessionId === storedSessionId) return false;

  event.preventDefault();
  event.stopImmediatePropagation();
  setTimerFeedback('別のタブで集中タイマーが進行中です。そのタブで続けるか、再読み込みして状態を合わせてください。');
  return true;
}

function initializeTabGuard() {
  if (hasLocalTimerContext()) {
    localSessionId = ensureStoredSessionId();
    return;
  }

  clearStoredSessionId();
}

startButton.addEventListener('click', (event) => {
  if (timerId !== null || completionReady) return;
  if (blockIfAnotherTabOwnsTimer(event)) return;

  const fullDuration = selectedMinutes * 60;
  const resuming = remainingSeconds > 0 && remainingSeconds < fullDuration;
  if (resuming) {
    localSessionId = localSessionId ?? ensureStoredSessionId();
    return;
  }

  localSessionId = createSessionId();
  writeStoredSessionId(localSessionId);
}, true);

resetButton.addEventListener('click', () => {
  if (completionReady) return;
  localSessionId = null;
  clearStoredSessionId();
}, true);

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (completionReady) return;
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

  if (event.key !== TAB_SESSION_KEY || !completionReady || !localSessionId) return;
  if (readStoredSessionId() === localSessionId) return;

  refreshProgressFromStorage();
  setRecordAvailability(false);
  setTimerFeedback('この集中は別のタブで処理されました。最新の記録を反映しました。', 'complete');
  localSessionId = null;
});

initializeTabGuard();
