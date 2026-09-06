const taskInput = document.querySelector('#task-input');
const timer = document.querySelector('#timer');
const startButton = document.querySelector('#start-button');
const resetButton = document.querySelector('#reset-button');
const presetButtons = [...document.querySelectorAll('[data-minutes]')];
const doneButton = document.querySelector('#done-button');
const doneCount = document.querySelector('#done-count');

const DEFAULT_MINUTES = 25;
const MAX_MINUTES = 180;
const STORAGE_KEYS = {
  task: 'one.task',
  count: 'one.doneCount',
  timer: 'one.timer.v1',
};

let selectedMinutes = DEFAULT_MINUTES;
let remainingSeconds = selectedMinutes * 60;
let timerId = null;
let endAt = null;

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

function loadState() {
  taskInput.value = safeRead(STORAGE_KEYS.task);
  const count = Number.parseInt(safeRead(STORAGE_KEYS.count, '0'), 10);
  doneCount.textContent = String(Number.isFinite(count) && count >= 0 ? count : 0);
  restoreTimerState();
}

taskInput.addEventListener('input', () => {
  safeWrite(STORAGE_KEYS.task, taskInput.value.slice(0, 120));
});

startButton.addEventListener('click', toggleTimer);
resetButton.addEventListener('click', resetTimer);
presetButtons.forEach((button) => button.addEventListener('click', () => selectPreset(button)));

doneButton.addEventListener('click', () => {
  const current = Number.parseInt(doneCount.textContent, 10) || 0;
  const next = Math.min(current + 1, Number.MAX_SAFE_INTEGER);
  doneCount.textContent = String(next);
  safeWrite(STORAGE_KEYS.count, String(next));
  resetTimer();
});

loadState();
