const DONE_COUNT_STORAGE_KEY = 'one.doneCount';
const HISTORY_STORAGE_KEY = 'one.history.v1';
const HISTORY_LIMIT = 90;
const MAX_DAILY_COUNT = 1000;
const MAX_HISTORY_BYTES = 50_000;
const MAX_DONE_COUNT_BYTES = 32;
const DONE_COUNT_PATTERN = /^(0|[1-9]\d{0,15})$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const listeners = new Set();
let storageAccessFailed = false;
let renderedDateKey = null;

function reportStorageFailure() {
  storageAccessFailed = true;
  window.dispatchEvent(new Event('one:storage-error'));
}

function safeRead(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    reportStorageFailure();
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    reportStorageFailure();
    return false;
  }
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
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, count]) => (
        isValidDateKey(key)
        && Number.isInteger(count)
        && count >= 0
        && count <= MAX_DAILY_COUNT
      ))
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, HISTORY_LIMIT),
  );
}

function freezeHistory(history) {
  return Object.freeze({ ...normalizeHistory(history) });
}

export function parseDoneCount(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DONE_COUNT_BYTES) return 0;
  if (!DONE_COUNT_PATTERN.test(raw)) return 0;

  const count = Number(raw);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function readDoneCount() {
  return parseDoneCount(safeRead(DONE_COUNT_STORAGE_KEY, '0'));
}

function readHistory() {
  const raw = safeRead(HISTORY_STORAGE_KEY);
  if (!raw || raw.length > MAX_HISTORY_BYTES) return {};

  try {
    return normalizeHistory(JSON.parse(raw));
  } catch {
    return {};
  }
}

function parseHistoryStorageEvent(raw) {
  if (raw === null) return {};
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_HISTORY_BYTES) return null;

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return normalizeHistory(value);
  } catch {
    return null;
  }
}

function parseDoneCountStorageEvent(raw) {
  if (raw === null) return 0;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DONE_COUNT_BYTES) return null;
  if (!DONE_COUNT_PATTERN.test(raw)) return null;

  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function initialState() {
  const doneCount = readDoneCount();
  const history = readHistory();
  renderedDateKey = dateKey();
  return Object.freeze({
    doneCount: String(doneCount),
    history: freezeHistory(history),
  });
}

let currentState = initialState();

function notify() {
  listeners.forEach((listener) => listener());
}

function replaceState({ doneCount, history }) {
  currentState = Object.freeze({
    doneCount: String(doneCount),
    history: freezeHistory(history),
  });
  renderedDateKey = dateKey();
  notify();
}

function refreshDateSensitiveState() {
  const today = dateKey();
  if (renderedDateKey === today) return;

  renderedDateKey = today;
  currentState = Object.freeze({
    doneCount: currentState.doneCount,
    history: currentState.history,
  });
  notify();
}

function syncProgressFromStorage(event) {
  if (event.key === HISTORY_STORAGE_KEY) {
    const nextHistory = parseHistoryStorageEvent(event.newValue);
    if (nextHistory === null) return;
    replaceState({ doneCount: currentState.doneCount, history: nextHistory });
    return;
  }

  if (event.key === DONE_COUNT_STORAGE_KEY) {
    const nextCount = parseDoneCountStorageEvent(event.newValue);
    if (nextCount === null) return;
    replaceState({ doneCount: nextCount, history: currentState.history });
  }
}

function refreshFromStorage() {
  if (storageAccessFailed) return false;

  const nextCount = readDoneCount();
  if (storageAccessFailed) return false;

  const nextHistory = readHistory();
  if (storageAccessFailed) return false;

  replaceState({ doneCount: nextCount, history: nextHistory });
  return true;
}

function incrementInMemory(completedOn = dateKey()) {
  const historyKey = isValidDateKey(completedOn) ? completedOn : dateKey();
  const currentCount = parseDoneCount(currentState.doneCount);
  const nextCount = Math.min(currentCount + 1, Number.MAX_SAFE_INTEGER);
  const history = { ...currentState.history };
  const currentHistoryCount = Number.isInteger(history[historyKey]) ? history[historyKey] : 0;
  const nextHistoryCount = Math.min(currentHistoryCount + 1, MAX_DAILY_COUNT);
  history[historyKey] = nextHistoryCount;

  replaceState({ doneCount: nextCount, history });
  return {
    nextCount,
    historyKey,
    expectedHistoryCount: currentState.history[historyKey] ?? nextHistoryCount,
  };
}

function persistDoneCountAtLeast(expectedCount) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) return false;
  if (!safeWrite(DONE_COUNT_STORAGE_KEY, String(expectedCount))) return false;

  const storedCount = readDoneCount();
  if (storageAccessFailed) return false;
  if (storedCount >= expectedCount) return true;

  reportStorageFailure();
  return false;
}

function persistHistoryEntryAtLeast(historyKey, expectedCount) {
  if (!isValidDateKey(historyKey) || !Number.isInteger(expectedCount) || expectedCount < 0) return false;
  if (!safeWrite(HISTORY_STORAGE_KEY, JSON.stringify(currentState.history))) return false;

  const storedHistory = readHistory();
  if (storageAccessFailed) return false;
  if ((storedHistory[historyKey] ?? 0) >= expectedCount) return true;

  reportStorageFailure();
  return false;
}

function restoreBackupData(restored) {
  if (!Number.isSafeInteger(restored?.doneCount) || restored.doneCount < 0) return false;
  if (!restored.history || typeof restored.history !== 'object' || Array.isArray(restored.history)) return false;

  const normalized = normalizeHistory(restored.history);
  const inputEntries = Object.entries(restored.history);
  if (Object.keys(normalized).length !== inputEntries.length) return false;

  const historySum = Object.values(normalized).reduce((sum, count) => sum + count, 0);
  if (!Number.isSafeInteger(historySum) || restored.doneCount < historySum) return false;

  const countPersisted = safeWrite(DONE_COUNT_STORAGE_KEY, String(restored.doneCount));
  const historyPersisted = safeWrite(HISTORY_STORAGE_KEY, JSON.stringify(normalized));
  replaceState({ doneCount: restored.doneCount, history: normalized });
  return countPersisted && historyPersisted && !storageAccessFailed;
}

export function getProgressSnapshot() {
  return currentState;
}

export function subscribeProgress(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const progressActions = Object.freeze({
  record() {
    return globalThis.ONE_TAB_GUARD?.recordPendingCompletion?.() === true;
  },
  discard() {
    return globalThis.ONE_TAB_GUARD?.discardPendingCompletion?.() === true;
  },
  restoreBackupData,
});

const progressRuntime = Object.freeze({
  snapshot: getProgressSnapshot,
  refreshFromStorage,
  incrementInMemory,
  persistDoneCountAtLeast,
  persistHistoryEntryAtLeast,
});

globalThis.ONE_PROGRESS_RUNTIME = progressRuntime;
globalThis.ONE_TAB_GUARD?.registerProgressRuntime?.(progressRuntime);

window.addEventListener('storage', syncProgressFromStorage);
window.addEventListener('pageshow', refreshFromStorage);
window.addEventListener('focus', refreshDateSensitiveState);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  refreshDateSensitiveState();
  refreshFromStorage();
});
