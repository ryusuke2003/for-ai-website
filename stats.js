const weekCount = document.querySelector('#week-count');
const streakCount = document.querySelector('#streak-count');
const streakStatus = document.querySelector('#streak-status');

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
  renderProgressInsights();
};

renderProgressInsights();
