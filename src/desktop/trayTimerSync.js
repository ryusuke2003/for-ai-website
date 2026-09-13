import { invoke, isTauri } from '@tauri-apps/api/core';
import { getTimerSnapshot, subscribeTimer } from '../features/timer/timerStore.js';

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? Math.floor(totalSeconds) : 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatTrayTimerTitle(state) {
  if (state?.completionReady === true || state?.remainingSeconds === 0) {
    return '00:00';
  }

  if (state?.running === true) {
    return formatClock(state.remainingSeconds);
  }

  const fullDuration = Number.isInteger(state?.selectedMinutes)
    ? state.selectedMinutes * 60
    : null;
  const paused = Number.isInteger(state?.remainingSeconds)
    && fullDuration !== null
    && state.remainingSeconds > 0
    && state.remainingSeconds < fullDuration;

  if (paused) {
    return `⏸ ${formatClock(state.remainingSeconds)}`;
  }

  return 'ONE';
}

export function startTrayTimerSync() {
  if (!isTauri()) return () => {};

  let lastTitle = null;

  const sync = () => {
    const title = formatTrayTimerTitle(getTimerSnapshot());
    if (title === lastTitle) return;
    lastTitle = title;
    void invoke('set_tray_title', { title }).catch(() => {});
  };

  sync();
  return subscribeTimer(sync);
}
