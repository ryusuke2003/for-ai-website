import { timerStateGuard } from './timerStateGuard.js';

export const TRAY_BREAK_MINUTES = 5;
export const TRAY_LAST_FOCUS_MINUTES_KEY = 'one.trayLastFocusMinutes.v1';

let fallbackLastFocusMinutes = 25;

function isValidFocusMinutes(minutes) {
  return Number.isInteger(minutes)
    && minutes >= timerStateGuard.minMinutes
    && minutes <= timerStateGuard.maxMinutes
    && minutes !== TRAY_BREAK_MINUTES;
}

function readLastFocusMinutes() {
  try {
    const stored = Number(localStorage.getItem(TRAY_LAST_FOCUS_MINUTES_KEY));
    if (isValidFocusMinutes(stored)) {
      fallbackLastFocusMinutes = stored;
      return stored;
    }
  } catch {
    // localStorageが使えなくても、この起動中はメモリ上の値で継続する。
  }

  return fallbackLastFocusMinutes;
}

function rememberFocusMinutes(minutes) {
  if (!isValidFocusMinutes(minutes)) return false;

  fallbackLastFocusMinutes = minutes;
  try {
    localStorage.setItem(TRAY_LAST_FOCUS_MINUTES_KEY, String(minutes));
  } catch {
    // 休憩から戻すための補助情報なので、保存失敗時もタイマー本体は継続する。
  }
  return true;
}

export function advanceTrayTimerAfterCompletion(state, actions) {
  if (!state?.completionReady) return false;

  const completedMinutes = state.selectedMinutes;
  if (completedMinutes === TRAY_BREAK_MINUTES) {
    const nextFocusMinutes = readLastFocusMinutes();
    if (actions?.discard?.() !== true) return false;
    return actions?.selectMinutes?.(nextFocusMinutes) === true;
  }

  if (!rememberFocusMinutes(completedMinutes)) return false;
  if (actions?.record?.() !== true) return false;
  return actions?.selectMinutes?.(TRAY_BREAK_MINUTES) === true;
}
