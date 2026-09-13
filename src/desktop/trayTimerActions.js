import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getTimerSnapshot, timerActions } from '../features/timer/timerStore.js';

const FOCUS_MINUTES = 25;
const BREAK_MINUTES = 5;

function startPreset(minutes, actions) {
  if (actions.selectMinutes(minutes) !== true) return false;
  return actions.toggle() === true;
}

export function applyTrayTimerAction(
  action,
  { actions = timerActions, snapshot = getTimerSnapshot } = {},
) {
  const state = snapshot();

  switch (action) {
    case 'start':
      if (state?.running === true || state?.completionReady === true) return false;
      return actions.toggle() === true;
    case 'pause':
      if (state?.running !== true) return false;
      return actions.toggle() === true;
    case 'reset':
      return actions.reset() === true;
    case 'start-25':
      if (state?.completionReady === true) return false;
      return startPreset(FOCUS_MINUTES, actions);
    case 'break-5':
      if (state?.completionReady === true) return false;
      return startPreset(BREAK_MINUTES, actions);
    default:
      return false;
  }
}

export async function startTrayTimerActions() {
  if (!isTauri()) return () => {};

  try {
    return await listen('one:tray-timer-action', (event) => {
      applyTrayTimerAction(event.payload);
    });
  } catch {
    return () => {};
  }
}
