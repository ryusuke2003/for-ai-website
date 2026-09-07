const weekCount = document.querySelector('#week-count');
const streakCount = document.querySelector('#streak-count');
const streakStatus = document.querySelector('#streak-status');
const activityGrid = document.querySelector('#activity-grid');
const activitySummary = document.querySelector('#activity-summary');

const ACTIVITY_DAYS = 30;

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
}

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
