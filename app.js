const doneCount = document.querySelector('#done-count');

const MAX_MINUTES = 180;
const HISTORY_LIMIT = 90;
const MAX_DAILY_COUNT = 1000;
const MAX_HISTORY_BYTES = 50_000;
const MAX_DONE_COUNT_BYTES = 32;
const DONE_COUNT_PATTERN = /^(0|[1-9]\d{0,15})$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STORAGE_KEYS = {
  count: 'one.doneCount',
  timer: 'one.timer.v1',
  history: 'one.history.v1',
};

let focusHistory = {};
let renderedDateKey = null;
let storageAccessFailed = false;

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

function parseDoneCount(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DONE_COUNT_BYTES) return 0;
  if (!DONE_COUNT_PATTERN.test(raw)) return 0;

  const count = Number(raw);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function readDoneCount() {
  return parseDoneCount(safeRead(STORAGE_KEYS.count, '0'));
}

function readTimerState() {
  const raw = safeRead(STORAGE_KEYS.timer);
  return globalThis.ONE_TIMER_STATE_GUARD?.parse(raw) ?? null;
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(key) {
  if (!DATE_KEY_PATTERN.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, count]) => isValidDateKey(key) && Number.isInteger(count) && count >= 0 && count <= MAX_DAILY_COUNT)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, HISTORY_LIMIT),
  );
}

function readHistory() {
  const raw = safeRead(STORAGE_KEYS.history);
  if (!raw || raw.length > MAX_HISTORY_BYTES) return {};

  try {
    return normalizeHistory(JSON.parse(raw));
  } catch {
    return {};
  }
}

function saveHistory() {
  focusHistory = normalizeHistory(focusHistory);
  safeWrite(STORAGE_KEYS.history, JSON.stringify(focusHistory));
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

function renderHistory() {
  renderedDateKey = dateKey();
}

function refreshDateSensitiveUi() {
  if (renderedDateKey !== dateKey()) renderHistory();
}

function syncProgressFromStorage(event) {
  if (event.key === STORAGE_KEYS.history) {
    const nextHistory = parseHistoryStorageEvent(event.newValue);
    if (nextHistory === null) return;

    focusHistory = nextHistory;
    renderHistory();
    return;
  }

  if (event.key === STORAGE_KEYS.count) {
    const nextCount = parseDoneCountStorageEvent(event.newValue);
    if (nextCount === null) return;
    doneCount.textContent = String(nextCount);
  }
}

function refreshProgressFromStorage() {
  if (storageAccessFailed) return;

  const nextCount = readDoneCount();
  if (storageAccessFailed) return;

  const nextHistory = readHistory();
  if (storageAccessFailed) return;

  doneCount.textContent = String(nextCount);
  focusHistory = nextHistory;
  renderHistory();
}

function refreshProgressWhenVisible() {
  if (document.visibilityState === 'visible') refreshProgressFromStorage();
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

function loadProgressState() {
  doneCount.textContent = String(readDoneCount());
  focusHistory = readHistory();
  renderHistory();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshDateSensitiveUi();
});
document.addEventListener('visibilitychange', refreshProgressWhenVisible);
window.addEventListener('focus', refreshDateSensitiveUi);
window.addEventListener('storage', syncProgressFromStorage);
window.addEventListener('pageshow', refreshProgressFromStorage);

loadProgressState();