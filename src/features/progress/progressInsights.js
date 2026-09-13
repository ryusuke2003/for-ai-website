const HISTORY_LIMIT = 90;
const ACTIVITY_DAYS = 30;

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localNoon(date = new Date()) {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  return value;
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, count]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isInteger(count) && count >= 0)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, HISTORY_LIMIT),
  );
}

function currentDayAriaLabel(key, count) {
  return `今日 ${key}: ${count}回`;
}

export function calculateCurrentWeekCount(historyValue, today = new Date()) {
  const history = normalizeHistory(historyValue);
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

export function calculateCurrentStreak(historyValue, today = new Date()) {
  const history = normalizeHistory(historyValue);
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

export function calculateActivityWindow(historyValue, today = new Date()) {
  const history = normalizeHistory(historyValue);
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

function buildHistoryWindow(history, today) {
  const todayKey = dateKey(today);
  const weekdayFormatter = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' });
  const days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = localNoon(today);
    day.setDate(day.getDate() - offset);
    const key = dateKey(day);
    const count = history[key] ?? 0;
    const current = key === todayKey;

    days.push({
      ariaLabel: current ? currentDayAriaLabel(key, count) : `${key}: ${count}回`,
      current,
      level: Math.min(count, 4),
      count: String(count),
      weekday: current ? '今日' : weekdayFormatter.format(day),
    });
  }

  return days;
}

export function buildProgressInsights(historyValue, today = new Date()) {
  const history = normalizeHistory(historyValue);
  const todayKey = dateKey(today);
  const todayCount = history[todayKey] ?? 0;
  const weekly = calculateCurrentWeekCount(history, today);
  const streak = calculateCurrentStreak(history, today);
  const visibleStreak = streak.capped ? `${streak.days}+` : String(streak.days);
  const activityWindow = calculateActivityWindow(history, today);
  const activity = [];

  for (let index = 0; index < activityWindow.leadingPlaceholders; index += 1) {
    activity.push({
      ariaLabel: '',
      current: false,
      placeholder: true,
      level: 0,
    });
  }

  activityWindow.days.forEach(({ key, count }) => {
    const current = key === todayKey;
    activity.push({
      ariaLabel: current ? currentDayAriaLabel(key, count) : `${key}: ${count}回`,
      current,
      placeholder: false,
      level: Math.min(count, 4),
    });
  });

  let streakStatus = '今日1回から連続記録を始められます。';
  if (streak.days > 0 && streak.todayHasFocus) {
    streakStatus = streak.capped
      ? `${streak.days}日以上、連続で集中できています。`
      : `${streak.days}日連続で集中できています。`;
  } else if (streak.days > 0) {
    streakStatus = streak.capped
      ? `昨日まで${streak.days}日以上連続。今日1回で継続できます。`
      : `昨日まで${streak.days}日連続。今日1回で継続できます。`;
  }

  return {
    todayCount: String(todayCount),
    weekCount: String(weekly),
    streakCount: visibleStreak,
    streakAriaLabel: streak.capped ? `${streak.days}日以上` : `${streak.days}日`,
    streakStatus,
    history: buildHistoryWindow(history, today),
    activity,
    activitySummary: `直近30日: ${activityWindow.total}回 · ${activityWindow.activeDays}日活動`,
  };
}
