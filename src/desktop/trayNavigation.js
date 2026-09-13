import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function applyTrayNavigation(target) {
  if (target !== 'todo') return false;
  window.location.hash = 'todo';
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
