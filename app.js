const taskInput = document.querySelector('#task-input');
const timer = document.querySelector('#timer');
const startButton = document.querySelector('#start-button');
const resetButton = document.querySelector('#reset-button');
const focusModeButton = document.querySelector('#focus-mode-button');
const focusModeStatus = document.querySelector('#focus-mode-status');
const presetButtons = [...document.querySelectorAll('[data-minutes]')];
const doneButton = document.querySelector('#done-button');
const doneCount = document.querySelector('#done-count');
const todayCount = document.querySelector('#today-count');
const historyGrid = document.querySelector('#history-grid');

const DEFAULT_MINUTES = 25;
const MAX_MINUTES = 180;
const HISTORY_LIMIT = 90;
const MAX_DAILY_COUNT = 1000;
const MAX_HISTORY_BYTES = 50_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STORAGE_KEYS = {
  task: 'one.task',
  count: 'one.doneCount',
  timer: 'one.timer.v1',
  history: 'one.history.v1',
  focusMode: 'one.focusMode.v1',
};

let selectedMinutes = DEFAULT_MINUTES;
let remainingSeconds = selectedMinutes * 60;
let timerId = null;
let endAt = null;
let focusHistory = {};

function safeRead(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The app remains usable when storage is disabled.
  }
}

function readTimerState() {
  const raw = safeRead(STORAGE_KEYS.timer);
  if (!raw) return null;

  try {
    const state = JSON.parse(raw);
    return state && typeof state === 'object' && !Array.isArray(state) ? state : null;
  } catch {
    return null;
  }
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

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderTimer() {
  timer.textContent = formatTime(remainingSeconds);
  document.title = timerId ? `${formatTime(remainingSeconds)} — ONE` : 'ONE — 今日やる一つだけ';
}

function saveTimerState() {
  safeWrite(STORAGE_KEYS.timer, JSON.stringify({
    selectedMinutes,
    remainingSeconds,
    running: timerId !== null && endAt !== null,
    endAt: timerId !== null ? endAt : null,
  }));
}

function clearTimerInterval() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function setStartButton(label, running = false) {
  startButton.textContent = label;
  startButton.setAttribute('aria-pressed', String(running));
}

function setFocusMode(enabled, { persist = true, announce = true } = {}) {
  const active = enabled === true;
  document.body.classList.toggle('focus-mode', active);
  focusModeButton.setAttribute('aria-pressed', String(active));
  focusModeButton.textContent = active ? '通常表示' : '集中表示';
  focusModeButton.setAttribute('aria-label', active ? '通常表示に戻る' : '集中表示に切り替える');

  if (persist) safeWrite(STORAGE_KEYS.focusMode, active ? '1' : '0');
  if (announce) {
    focusModeStatus.textContent = active
      ? '集中表示に切り替えました。Escapeキーでも通常表示に戻れます。'
      : '通常表示に戻りました。';
  }
}

function stopTimer(label = 'スタート', persist = true) {
  clearTimerInterval();
  endAt = null;
  setStartButton(label);
  renderTimer();
  if (persist) saveTimerState();
}

function finishTimer() {
  remainingSeconds = 0;
  stopTimer('もう一度');
}

function tick() {
  if (endAt === null) return;
  remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  renderTimer();
  if (remainingSeconds === 0) finishTimer();
}

function startTimer() {
  if (remainingSeconds <= 0) remainingSeconds = selectedMinutes * 60;
  endAt = Date.now() + remainingSeconds * 1000;
  timerId = window.setInterval(tick, 250);
  setStartButton('一時停止', true);
  saveTimerState();
  tick();
}

function toggleTimer() {
  if (timerId !== null) {
    if (endAt !== null) {
      remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    }
    stopTimer(remainingSeconds > 0 ? '再開' : 'もう一度');
    return;
  }
  startTimer();
}

function resetTimer() {
  stopTimer('スタート', false);
  remainingSeconds = selectedMinutes * 60;
  renderTimer();
  saveTimerState();
}

function selectPreset(button) {
  const minutes = Number.parseInt(button.dataset.minutes, 10);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES) return;

  selectedMinutes = minutes;
  presetButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  resetTimer();
}

function restoreTimerState() {
  const state = readTimerState();
  const availableMinutes = presetButtons
    .map((button) => Number.parseInt(button.dataset.minutes, 10))
    .filter((minutes) => Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_MINUTES);

  const storedMinutes = Number.parseInt(state?.selectedMinutes, 10);
  selectedMinutes = availableMinutes.includes(storedMinutes) ? storedMinutes : DEFAULT_MINUTES;

  presetButtons.forEach((button) => {
    const active = Number.parseInt(button.dataset.minutes, 10) === selectedMinutes;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const fullDuration = selectedMinutes * 60;
  const storedRemaining = Number.parseInt(state?.remainingSeconds, 10);
  remainingSeconds = Number.isInteger(storedRemaining) && storedRemaining >= 0 && storedRemaining <= fullDuration
    ? storedRemaining
    : fullDuration;

  const storedEndAt = Number(state?.endAt);
  if (state?.running === true && Number.isFinite(storedEndAt)) {
    const restoredRemaining = Math.ceil((storedEndAt - Date.now()) / 1000);
    if (restoredRemaining > 0 && restoredRemaining <= fullDuration) {
      remainingSeconds = restoredRemaining;
      endAt = storedEndAt;
      timerId = window.setInterval(tick, 250);
      setStartButton('一時停止', true);
      renderTimer();
      saveTimerState();
      return;
    }

    if (restoredRemaining <= 0) {
      remainingSeconds = 0;
      setStartButton('もう一度');
      renderTimer();
      saveTimerState();
      return;
    }
  }

  setStartButton(remainingSeconds > 0 && remainingSeconds < fullDuration ? '再開' : remainingSeconds === 0 ? 'もう一度' : 'スタート');
  renderTimer();
  saveTimerState();
}

function renderHistory() {
  const todayKey = dateKey();
  todayCount.textContent = String(focusHistory[todayKey] ?? 0);
  historyGrid.replaceChildren();

  const weekdayFormatter = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' });

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - offset);

    const key = dateKey(day);
    const count = focusHistory[key] ?? 0;
    const item = document.createElement('div');
    const bar = document.createElement('span');
    const weekday = document.createElement('span');
    const value = document.createElement('strong');

    item.className = 'history-day';
    item.setAttribute('role', 'listitem');
    item.setAttribute('aria-label', `${key}: ${count}回`);

    bar.className = `history-bar level-${Math.min(count, 4)}`;
    bar.setAttribute('aria-hidden', 'true');
    weekday.className = 'history-weekday';
    weekday.textContent = offset === 0 ? '今日' : weekdayFormatter.format(day);
    value.textContent = String(count);

    item.append(bar, value, weekday);
    historyGrid.append(item);
  }
}

function incrementFocusHistory() {
  const key = dateKey();
  const current = Number.isInteger(focusHistory[key]) ? focusHistory[key] : 0;
  focusHistory[key] = Math.min(current + 1, MAX_DAILY_COUNT);
  saveHistory();
  renderHistory();
}

function loadState() {
  taskInput.value = safeRead(STORAGE_KEYS.task).slice(0, 120);
  const count = Number.parseInt(safeRead(STORAGE_KEYS.count, '0'), 10);
  doneCount.textContent = String(Number.isSafeInteger(count) && count >= 0 ? count : 0);
  focusHistory = readHistory();
  renderHistory();
  setFocusMode(safeRead(STORAGE_KEYS.focusMode) === '1', { persist: false, announce: false });
  restoreTimerState();
}

taskInput.addEventListener('input', () => {
  safeWrite(STORAGE_KEYS.task, taskInput.value.slice(0, 120));
});

startButton.addEventListener('click', toggleTimer);
resetButton.addEventListener('click', resetTimer);
focusModeButton.addEventListener('click', () => {
  setFocusMode(!document.body.classList.contains('focus-mode'));
});
presetButtons.forEach((button) => button.addEventListener('click', () => selectPreset(button)));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('focus-mode')) {
    setFocusMode(false);
    focusModeButton.focus();
  }
});

doneButton.addEventListener('click', () => {
  const current = Number.parseInt(doneCount.textContent, 10) || 0;
  const next = Math.min(current + 1, Number.MAX_SAFE_INTEGER);
  doneCount.textContent = String(next);
  safeWrite(STORAGE_KEYS.count, String(next));
  incrementFocusHistory();
  resetTimer();
});

loadState();
