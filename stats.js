const weekCount = document.querySelector('#week-count');
const streakCount = document.querySelector('#streak-count');
const streakStatus = document.querySelector('#streak-status');
const activityGrid = document.querySelector('#activity-grid');
const activitySummary = document.querySelector('#activity-summary');
const dailyGoalInput = document.querySelector('#daily-goal-input');
const dailyGoalApplyButton = document.querySelector('#daily-goal-apply');
const dailyGoalClearButton = document.querySelector('#daily-goal-clear');
const dailyGoalStatus = document.querySelector('#daily-goal-status');

const ACTIVITY_DAYS = 30;
const DAILY_GOAL_STORAGE_KEY = 'one.dailyGoal.v1';
const MIN_DAILY_GOAL = 1;
const MAX_DAILY_GOAL = 12;
const MAX_DAILY_GOAL_STATE_BYTES = 128;

let dailyGoal = null;
let dailyGoalDate = null;
let dailyGoalPersistenceWarning = '';

function localNoon(date = new Date()) {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  return value;
}

function calculateCurrentWeekCount(history, today = new Date()) {
  const currentDay = localNoon(today);
  const monday = localNoon(today);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);

  let total = 0;
  const cursor = new Date(monday);
  while (cursor <= currentDay) {
    const count = history[dateKey(cursor)] ?? 0;
    if (Number.isInteger(count) && count > 0) total += count;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function calculateCurrentStreak(history, today = new Date()) {
  const cursor = localNoon(today);
  const todayHasFocus = (history[dateKey(cursor)] ?? 0) > 0;

  if (!todayHasFocus) cursor.setDate(cursor.getDate() - 1);

  let days = 0;
  while (days < HISTORY_LIMIT) {
    const count = history[dateKey(cursor)] ?? 0;
    if (!Number.isInteger(count) || count <= 0) break;

    days += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    days,
    capped: days === HISTORY_LIMIT,
    todayHasFocus,
  };
}

function calculateActivityWindow(history, today = new Date()) {
  const start = localNoon(today);
  start.setDate(start.getDate() - (ACTIVITY_DAYS - 1));

  const days = [];
  let total = 0;
  let activeDays = 0;

  for (let offset = 0; offset < ACTIVITY_DAYS; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    const key = dateKey(day);
    const storedCount = history[key] ?? 0;
    const count = Number.isInteger(storedCount) && storedCount > 0 ? storedCount : 0;

    total += count;
    if (count > 0) activeDays += 1;
    days.push({ key, count });
  }

  return {
    days,
    total,
    activeDays,
    leadingPlaceholders: (start.getDay() + 6) % 7,
  };
}

function currentDayAriaLabel(key, count) {
  return `今日 ${key}: ${count}回`;
}

function markCurrentHistoryDay() {
  const todayKey = dateKey();
  const storedCount = focusHistory[todayKey] ?? 0;
  const count = Number.isInteger(storedCount) && storedCount > 0 ? storedCount : 0;
  const items = [...historyGrid.querySelectorAll('.history-day[role="listitem"]')];

  items.forEach((item) => {
    const label = item.getAttribute('aria-label') ?? '';
    if (!label.startsWith(`${todayKey}:`)) {
      item.removeAttribute('aria-current');
      return;
    }

    item.setAttribute('aria-current', 'date');
    item.setAttribute('aria-label', currentDayAriaLabel(todayKey, count));
  });
}

function renderActivityMap() {
  const history = normalizeHistory(focusHistory);
  const activity = calculateActivityWindow(history);
  const todayKey = dateKey();
  const cells = [];

  for (let index = 0; index < activity.leadingPlaceholders; index += 1) {
    const placeholder = document.createElement('span');
    placeholder.className = 'activity-day is-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    cells.push(placeholder);
  }

  activity.days.forEach(({ key, count }) => {
    const item = document.createElement('span');
    const isToday = key === todayKey;
    item.className = `activity-day level-${Math.min(count, 4)}`;
    item.setAttribute('role', 'listitem');
    item.setAttribute('aria-label', isToday ? currentDayAriaLabel(key, count) : `${key}: ${count}回`);
    if (isToday) {
      item.classList.add('is-today');
      item.setAttribute('aria-current', 'date');
    }
    cells.push(item);
  });

  activityGrid.replaceChildren(...cells);
  activitySummary.textContent = `直近30日: ${activity.total}回 · ${activity.activeDays}日活動`;
}

function isPlainDailyGoalState(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseDailyGoalState(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DAILY_GOAL_STATE_BYTES) return null;

  try {
    const value = JSON.parse(raw);
    if (!isPlainDailyGoalState(value)) return null;
    if (Object.keys(value).length !== 2 || !Object.hasOwn(value, 'date') || !Object.hasOwn(value, 'goal')) return null;
    if (typeof value.date !== 'string' || !isValidDateKey(value.date)) return null;
    if (!Number.isInteger(value.goal) || value.goal < MIN_DAILY_GOAL || value.goal > MAX_DAILY_GOAL) return null;
    return { date: value.date, goal: value.goal };
  } catch {
    return null;
  }
}

function removeStoredDailyGoal(expectedRaw) {
  try {
    const current = localStorage.getItem(DAILY_GOAL_STORAGE_KEY);
    if (expectedRaw !== undefined && current !== expectedRaw) return true;

    localStorage.removeItem(DAILY_GOAL_STORAGE_KEY);
    if (localStorage.getItem(DAILY_GOAL_STORAGE_KEY) === null) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

function loadDailyGoal() {
  if (storageAccessFailed) return;

  const raw = safeRead(DAILY_GOAL_STORAGE_KEY);
  if (storageAccessFailed || raw === '') return;

  const state = parseDailyGoalState(raw);
  if (!state || state.date !== dateKey()) {
    dailyGoalPersistenceWarning = removeStoredDailyGoal(raw)
      ? ''
      : ' 期限切れまたは不正な目標データを端末から削除できませんでした。';
    return;
  }

  dailyGoal = state.goal;
  dailyGoalDate = state.date;
  dailyGoalInput.value = String(state.goal);
}

function persistDailyGoal(goal) {
  const payload = JSON.stringify({ date: dateKey(), goal });
  if (!safeWrite(DAILY_GOAL_STORAGE_KEY, payload)) return false;

  const stored = safeRead(DAILY_GOAL_STORAGE_KEY);
  if (storageAccessFailed) return false;
  if (stored === payload) return true;

  reportStorageFailure();
  return false;
}

function clearExpiredDailyGoal() {
  if (dailyGoalDate === null || dailyGoalDate === dateKey()) return;

  dailyGoal = null;
  dailyGoalDate = null;
  dailyGoalPersistenceWarning = '';
  dailyGoalInput.value = '';
  dailyGoalInput.removeAttribute('aria-invalid');
  loadDailyGoal();
}

function todayFocusCount() {
  const count = focusHistory[dateKey()] ?? 0;
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function renderDailyGoal() {
  clearExpiredDailyGoal();
  const today = todayFocusCount();

  if (dailyGoal === null) {
    dailyGoalClearButton.hidden = true;
    todayCount.removeAttribute('aria-label');
    dailyGoalStatus.textContent = `今日の目標は未設定です。1〜12回で設定できます。${dailyGoalPersistenceWarning}`;
    return;
  }

  dailyGoalClearButton.hidden = false;
  const remaining = Math.max(dailyGoal - today, 0);
  const achieved = remaining === 0;
  dailyGoalStatus.textContent = achieved
    ? `今日の目標 ${dailyGoal}回を達成しました。現在${today}回です。${dailyGoalPersistenceWarning}`
    : `今日の目標 ${dailyGoal}回 · 現在${today}回 · あと${remaining}回。${dailyGoalPersistenceWarning}`;
  todayCount.setAttribute(
    'aria-label',
    achieved
      ? `今日 ${today}回、目標${dailyGoal}回を達成`
      : `今日 ${today}回、目標${dailyGoal}回まであと${remaining}回`,
  );
}

function parseDailyGoalInput() {
  const raw = dailyGoalInput.value.trim();
  if (raw === '') return null;

  const value = Number(raw);
  return Number.isInteger(value) && value >= MIN_DAILY_GOAL && value <= MAX_DAILY_GOAL ? value : null;
}

function applyDailyGoal() {
  const nextGoal = parseDailyGoalInput();
  if (nextGoal === null) {
    dailyGoalInput.setAttribute('aria-invalid', 'true');
    dailyGoalPersistenceWarning = '';
    dailyGoalStatus.textContent = '今日の目標は1〜12回の整数で設定してください。';
    return;
  }

  dailyGoal = nextGoal;
  dailyGoalDate = dateKey();
  dailyGoalInput.value = String(nextGoal);
  dailyGoalInput.removeAttribute('aria-invalid');
  dailyGoalPersistenceWarning = persistDailyGoal(nextGoal)
    ? ''
    : ' このタブでは反映していますが、端末へ保存できませんでした。再読み込みすると目標が解除される可能性があります。';
  renderDailyGoal();
}

function clearDailyGoal() {
  dailyGoal = null;
  dailyGoalDate = null;
  dailyGoalInput.value = '';
  dailyGoalInput.removeAttribute('aria-invalid');
  dailyGoalPersistenceWarning = removeStoredDailyGoal()
    ? ''
    : ' このタブでは解除しましたが、端末の保存値を削除できませんでした。再読み込みすると目標が戻る可能性があります。';
  renderDailyGoal();
}

function syncDailyGoalFromStorage(event) {
  if (event.key !== DAILY_GOAL_STORAGE_KEY) return;

  if (event.newValue === null) {
    dailyGoal = null;
    dailyGoalDate = null;
    dailyGoalInput.value = '';
    dailyGoalInput.removeAttribute('aria-invalid');
    dailyGoalPersistenceWarning = '';
    renderDailyGoal();
    return;
  }

  const state = parseDailyGoalState(event.newValue);
  if (!state) return;

  if (state.date !== dateKey()) {
    dailyGoal = null;
    dailyGoalDate = null;
    dailyGoalInput.value = '';
  } else {
    dailyGoal = state.goal;
    dailyGoalDate = state.date;
    dailyGoalInput.value = String(state.goal);
  }
  dailyGoalInput.removeAttribute('aria-invalid');
  dailyGoalPersistenceWarning = '';
  renderDailyGoal();
}

function refreshDailyGoalFromStorage() {
  if (storageAccessFailed) return;

  const raw = safeRead(DAILY_GOAL_STORAGE_KEY);
  if (storageAccessFailed) return;

  if (raw === '') {
    dailyGoal = null;
    dailyGoalDate = null;
    dailyGoalInput.value = '';
    dailyGoalInput.removeAttribute('aria-invalid');
    dailyGoalPersistenceWarning = '';
    renderDailyGoal();
    return;
  }

  const state = parseDailyGoalState(raw);
  if (!state || state.date !== dateKey()) {
    dailyGoal = null;
    dailyGoalDate = null;
    dailyGoalInput.value = '';
    dailyGoalInput.removeAttribute('aria-invalid');
    dailyGoalPersistenceWarning = removeStoredDailyGoal(raw)
      ? ''
      : ' 期限切れまたは不正な目標データを端末から削除できませんでした。';
    renderDailyGoal();
    return;
  }

  dailyGoal = state.goal;
  dailyGoalDate = state.date;
  dailyGoalInput.value = String(state.goal);
  dailyGoalInput.removeAttribute('aria-invalid');
  dailyGoalPersistenceWarning = '';
  renderDailyGoal();
}

function refreshDailyGoalWhenVisible() {
  if (document.visibilityState === 'visible') refreshDailyGoalFromStorage();
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

function renderProgressInsights() {
  const history = normalizeHistory(focusHistory);
  const weekly = calculateCurrentWeekCount(history);
  const streak = calculateCurrentStreak(history);
  const visibleStreak = streak.capped ? `${streak.days}+` : String(streak.days);

  weekCount.textContent = String(weekly);
  streakCount.textContent = visibleStreak;
  streakCount.setAttribute('aria-label', streak.capped ? `${streak.days}日以上` : `${streak.days}日`);

  if (streak.days === 0) {
    streakStatus.textContent = '今日1回から連続記録を始められます。';
  } else if (streak.todayHasFocus) {
    streakStatus.textContent = streak.capped
      ? `${streak.days}日以上、連続で集中できています。`
      : `${streak.days}日連続で集中できています。`;
  } else {
    streakStatus.textContent = streak.capped
      ? `昨日まで${streak.days}日以上連続。今日1回で継続できます。`
      : `昨日まで${streak.days}日連続。今日1回で継続できます。`;
  }

  renderDailyGoal();
}

loadDailyGoal();
dailyGoalApplyButton.addEventListener('click', applyDailyGoal);
dailyGoalInput.addEventListener('input', () => {
  dailyGoalInput.removeAttribute('aria-invalid');
});
dailyGoalInput.addEventListener('keydown', (event) => {
  if (event.isComposing || event.key !== 'Enter') return;
  event.preventDefault();
  applyDailyGoal();
});
dailyGoalClearButton.addEventListener('click', clearDailyGoal);
window.addEventListener('storage', syncDailyGoalFromStorage);
window.addEventListener('storage', syncProgressFromStorage);
document.addEventListener('visibilitychange', refreshDailyGoalWhenVisible);
document.addEventListener('visibilitychange', refreshProgressWhenVisible);
window.addEventListener('pageshow', refreshDailyGoalFromStorage);
window.addEventListener('pageshow', refreshProgressFromStorage);

const renderHistoryWithoutInsights = renderHistory;
renderHistory = function renderHistoryWithInsights() {
  renderHistoryWithoutInsights();
  markCurrentHistoryDay();
  renderProgressInsights();
  renderActivityMap();
};

markCurrentHistoryDay();
renderProgressInsights();
renderActivityMap();
