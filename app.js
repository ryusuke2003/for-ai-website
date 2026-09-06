const taskInput = document.querySelector('#task-input');
const timer = document.querySelector('#timer');
const timerCard = document.querySelector('.timer-card');
const timerStatus = document.querySelector('#timer-status');
const startButton = document.querySelector('#start-button');
const resetButton = document.querySelector('#reset-button');
const focusModeButton = document.querySelector('#focus-mode-button');
const focusModeStatus = document.querySelector('#focus-mode-status');
const presetButtons = [...document.querySelectorAll('[data-minutes]')];
const doneButton = document.querySelector('#done-button');
const discardButton = document.querySelector('#discard-button');
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
  taskDate: 'one.taskDate.v1',
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
let completionReady = false;
let completionDateKey = null;
let renderedDateKey = null;

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

function hasActiveDailyTaskContext() {
  const fullDuration = selectedMinutes * 60;
  return timerId !== null
    || completionReady
    || (remainingSeconds > 0 && remainingSeconds < fullDuration);
}

function loadDailyTask({ preserveActiveSession = false } = {}) {
  const today = dateKey();
  const storedTask = safeRead(STORAGE_KEYS.task).slice(0, 120);
  const storedTaskDate = safeRead(STORAGE_KEYS.taskDate);

  if (!storedTaskDate) {
    taskInput.value = storedTask;
    safeWrite(STORAGE_KEYS.taskDate, today);
    return;
  }

  if (storedTaskDate === today) {
    taskInput.value = storedTask;
    return;
  }

  if (preserveActiveSession && hasActiveDailyTaskContext()) {
    taskInput.value = storedTask;
    return;
  }

  taskInput.value = '';
  safeWrite(STORAGE_KEYS.task, '');
  safeWrite(STORAGE_KEYS.taskDate, today);
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

function setTimerFeedback(message, state = 'idle') {
  timerStatus.textContent = message;
  timerCard.classList.toggle('is-running', state === 'running');
  timerCard.classList.toggle('is-complete', state === 'complete');
}

function setPendingCompletionLock(locked) {
  startButton.disabled = locked;
  resetButton.disabled = locked;
  presetButtons.forEach((button) => {
    button.disabled = locked;
  });
  discardButton.hidden = !locked;
}

function setRecordAvailability(ready, completedOn = null) {
  completionReady = ready === true;
  completionDateKey = completionReady && typeof completedOn === 'string' && isValidDateKey(completedOn)
    ? completedOn
    : completionReady
      ? dateKey()
      : null;
  doneButton.disabled = !completionReady;
  doneButton.textContent = completionReady
    ? 'この集中を記録する ✓'
    : 'タイマー完了後に記録できます';
  setPendingCompletionLock(completionReady);
}

function renderTimer() {
  const formatted = formatTime(remainingSeconds);
  timer.textContent = formatted;
  timer.setAttribute('aria-label', `残り時間 ${formatted}`);
  document.title = timerId ? `${formatted} — ONE` : 'ONE — 今日やる一つだけ';
}

function saveTimerState() {
  safeWrite(STORAGE_KEYS.timer, JSON.stringify({
    selectedMinutes,
    remainingSeconds,
    running: timerId !== null && endAt !== null,
    endAt: timerId !== null ? endAt : null,
    completionReady,
    completionDate: completionReady ? completionDateKey : null,
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

function revealCompletionRecord() {
  if (document.body.classList.contains('focus-mode')) {
    setFocusMode(false, { announce: false });
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
  const completedOn = dateKey(new Date(endAt ?? Date.now()));
  remainingSeconds = 0;
  setRecordAvailability(true, completedOn);
  revealCompletionRecord();
  stopTimer('もう一度');
  setTimerFeedback('集中スプリント完了。この1回を記録するか、記録せず破棄してください。', 'complete');
  document.title = '完了！ — ONE';
}

function tick() {
  if (endAt === null) return;
  remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  renderTimer();
  if (remainingSeconds === 0) finishTimer();
}

function startTimer() {
  if (remainingSeconds <= 0) remainingSeconds = selectedMinutes * 60;
  setRecordAvailability(false);
  endAt = Date.now() + remainingSeconds * 1000;
  timerId = window.setInterval(tick, 250);
  setStartButton('一時停止', true);
  setTimerFeedback('集中中。今の一つだけに集中。', 'running');
  saveTimerState();
  tick();
}

function toggleTimer() {
  if (timerId !== null) {
    if (endAt !== null) {
      remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    }
    stopTimer(remainingSeconds > 0 ? '再開' : 'もう一度');
    setTimerFeedback(
      remainingSeconds > 0 ? '一時停止中。準備ができたら再開。' : '集中スプリント完了。',
      remainingSeconds > 0 ? 'paused' : 'complete',
    );
    return;
  }
  startTimer();
}

function resetTimer() {
  setRecordAvailability(false);
  stopTimer('スタート', false);
  remainingSeconds = selectedMinutes * 60;
  renderTimer();
  setTimerFeedback(`${selectedMinutes}分にリセットしました。`);
  saveTimerState();
  refreshDateSensitiveUi();
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
      setRecordAvailability(false);
      endAt = storedEndAt;
      timerId = window.setInterval(tick, 250);
      setStartButton('一時停止', true);
      setTimerFeedback('集中中。再読み込み前の続きから再開しました。', 'running');
      renderTimer();
      saveTimerState();
      return;
    }

    if (restoredRemaining <= 0) {
      remainingSeconds = 0;
      setRecordAvailability(true, dateKey(new Date(storedEndAt)));
      revealCompletionRecord();
      setStartButton('もう一度');
      setTimerFeedback('前回の集中スプリントは完了しています。この1回を記録するか、記録せず破棄してください。', 'complete');
      renderTimer();
      document.title = '完了！ — ONE';
      saveTimerState();
      return;
    }
  }

  const partiallyElapsed = remainingSeconds > 0 && remainingSeconds < fullDuration;
  const completed = remainingSeconds === 0;
  const legacyCompletedState = completed && state != null && typeof state.completionReady !== 'boolean';
  const storedCompletionDate = typeof state?.completionDate === 'string' && isValidDateKey(state.completionDate)
    ? state.completionDate
    : null;
  setRecordAvailability(
    completed && (state?.completionReady === true || legacyCompletedState),
    storedCompletionDate ?? dateKey(),
  );
  if (completionReady) revealCompletionRecord();
  setStartButton(partiallyElapsed ? '再開' : completed ? 'もう一度' : 'スタート');
  setTimerFeedback(
    partiallyElapsed
      ? '一時停止中。準備ができたら再開。'
      : completionReady
        ? '前回の集中スプリントは完了しています。この1回を記録するか、記録せず破棄してください。'
        : completed
          ? '前回の集中スプリントは記録済みです。もう一度始められます。'
          : '準備できたらスタート。',
    completed ? 'complete' : partiallyElapsed ? 'paused' : 'idle',
  );
  renderTimer();
  if (completed) document.title = '完了！ — ONE';
  saveTimerState();
}

function renderHistory() {
  const todayKey = dateKey();
  renderedDateKey = todayKey;
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

function refreshDateSensitiveUi() {
  if (renderedDateKey !== dateKey()) renderHistory();
  loadDailyTask({ preserveActiveSession: true });
}

function incrementFocusHistory(key = dateKey()) {
  const historyKey = isValidDateKey(key) ? key : dateKey();
  const current = Number.isInteger(focusHistory[historyKey]) ? focusHistory[historyKey] : 0;
  focusHistory[historyKey] = Math.min(current + 1, MAX_DAILY_COUNT);
  saveHistory();
  renderHistory();
}

function loadState() {
  const count = Number.parseInt(safeRead(STORAGE_KEYS.count, '0'), 10);
  doneCount.textContent = String(Number.isSafeInteger(count) && count >= 0 ? count : 0);
  focusHistory = readHistory();
  renderHistory();
  setFocusMode(safeRead(STORAGE_KEYS.focusMode) === '1', { persist: false, announce: false });
  restoreTimerState();
  loadDailyTask({ preserveActiveSession: true });
}

taskInput.addEventListener('focus', refreshDateSensitiveUi);
taskInput.addEventListener('beforeinput', refreshDateSensitiveUi);
taskInput.addEventListener('input', () => {
  safeWrite(STORAGE_KEYS.task, taskInput.value.slice(0, 120));
  safeWrite(STORAGE_KEYS.taskDate, dateKey());
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshDateSensitiveUi();
});
window.addEventListener('focus', refreshDateSensitiveUi);

discardButton.addEventListener('click', () => {
  if (!completionReady) return;

  const discardedOn = completionDateKey;
  resetTimer();
  setTimerFeedback(
    discardedOn && discardedOn !== dateKey()
      ? `${discardedOn}に完了した集中を記録せず破棄しました。`
      : '完了した集中を記録せず破棄しました。次のスプリントを始められます。',
  );
  startButton.focus();
});

doneButton.addEventListener('click', () => {
  if (!completionReady) return;

  const completedOn = completionDateKey;
  setRecordAvailability(false);
  const current = Number.parseInt(doneCount.textContent, 10) || 0;
  const next = Math.min(current + 1, Number.MAX_SAFE_INTEGER);
  doneCount.textContent = String(next);
  safeWrite(STORAGE_KEYS.count, String(next));
  incrementFocusHistory(completedOn);
  resetTimer();
  setTimerFeedback(
    completedOn && completedOn !== dateKey()
      ? `${completedOn}に完了した集中を1回記録しました。`
      : '完了した集中を1回記録しました。次のスプリントを始められます。',
  );
  startButton.focus();
});

loadState();
