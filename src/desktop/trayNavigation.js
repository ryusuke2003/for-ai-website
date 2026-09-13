import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const TRAY_NAVIGATION_APPLIED_EVENT = 'one:tray-navigation-applied';

const TARGET_HASH = Object.freeze({
  timer: '',
  todo: '#todo',
  'tray-timer': '#tray-timer',
  'tray-todo': '#tray-todo',
});

export function applyTrayNavigation(target) {
  if (!(target in TARGET_HASH)) return false;
  window.location.hash = TARGET_HASH[target];
  window.dispatchEvent(new CustomEvent(TRAY_NAVIGATION_APPLIED_EVENT, { detail: target }));
  return true;
}

export async function startTrayNavigation() {
  if (!isTauri()) return () => {};

  try {
    return await listen('one:tray-navigation', (event) => {
      applyTrayNavigation(event.payload);
    });
  } catch {
    return () => {};
  }
}
