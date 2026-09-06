const taskInput = document.querySelector('#task-input');
const timer = document.querySelector('#timer');
const startButton = document.querySelector('#start-button');
const resetButton = document.querySelector('#reset-button');
const presetButtons = [...document.querySelectorAll('[data-minutes]')];
const doneButton = document.querySelector('#done-button');
const doneCount = document.querySelector('#done-count');

const STORAGE_KEYS = {
  task: 'one.task',
  count: 'one.doneCount',
};

let selectedMinutes = 25;
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

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderTimer() {
  timer.textContent = formatTime(remainingSeconds);
  document.title = timerId ? `${formatTime(remainingSeconds)} — ONE` : 'ONE — 今日やる一つだけ';
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  endAt = null;
  startButton.textContent = 'スタート';
  startButton.setAttribute('aria-pressed', 'false');
  renderTimer();
}

function tick() {
  if (endAt === null) return;
  remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  renderTimer();
  if (remainingSeconds === 0) {
    stopTimer();
    startButton.textContent = 'もう一度';
  }
}

function startTimer() {
  if (remainingSeconds <= 0) remainingSeconds = selectedMinutes * 60;
  endAt = Date.now() + remainingSeconds * 1000;
  timerId = window.setInterval(tick, 250);
  startButton.textContent = '一時停止';
  startButton.setAttribute('aria-pressed', 'true');
  tick();
}

function toggleTimer() {
  if (timerId !== null) {
    if (endAt !== null) {
      remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    }
    stopTimer();
    return;
  }
  startTimer();
}

function resetTimer() {
  stopTimer();
  remainingSeconds = selectedMinutes * 60;
  renderTimer();
}

function selectPreset(button) {
  const minutes = Number.parseInt(button.dataset.minutes, 10);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 180) return;

  selectedMinutes = minutes;
  presetButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  resetTimer();
}

function loadState() {
  taskInput.value = safeRead(STORAGE_KEYS.task);
  const count = Number.parseInt(safeRead(STORAGE_KEYS.count, '0'), 10);
  doneCount.textContent = String(Number.isFinite(count) && count >= 0 ? count : 0);
  presetButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });
  startButton.setAttribute('aria-pressed', 'false');
  renderTimer();
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
