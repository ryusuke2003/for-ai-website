import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const TRAY_NAVIGATION_APPLIED_EVENT = 'one:tray-navigation-applied';

const LAST_TRAY_TARGET_KEY = 'one.tray.lastView.v1';
const DEFAULT_TRAY_TARGET = 'tray-todo';
const TRAY_TARGETS = new Set(['tray-timer', 'tray-todo']);
const TARGET_HASH = Object.freeze({
  timer: '',
  todo: '#todo',
  'tray-timer': '#tray-timer',
  'tray-todo': '#tray-todo',
});

function trayTargetFromHash(hash = window.location.hash) {
  if (hash === '#tray-timer') return 'tray-timer';
  if (hash === '#tray-todo') return 'tray-todo';
  return null;
}

export function rememberTrayTarget(target) {
  if (!TRAY_TARGETS.has(target)) return false;

  try {
    localStorage.setItem(LAST_TRAY_TARGET_KEY, target);
  } catch {
    // 記憶できない環境でもTray自体は通常どおり使えるようにする。
  }

  return true;
}

export function readLastTrayTarget() {
  try {
    const stored = localStorage.getItem(LAST_TRAY_TARGET_KEY);
    if (TRAY_TARGETS.has(stored)) return stored;
  } catch {
    // 保存領域が使えない場合は従来どおりTodoを初期表示する。
  }

  return DEFAULT_TRAY_TARGET;
}

function rememberCurrentTrayTarget() {
  const target = trayTargetFromHash();
  if (target) rememberTrayTarget(target);
}

export function applyTrayNavigation(requestedTarget) {
  const target = requestedTarget === 'tray-last' ? readLastTrayTarget() : requestedTarget;
  if (!(target in TARGET_HASH)) return false;

  window.location.hash = TARGET_HASH[target];
  if (TRAY_TARGETS.has(target)) rememberTrayTarget(target);
  window.dispatchEvent(new CustomEvent(TRAY_NAVIGATION_APPLIED_EVENT, { detail: target }));
  return true;
}

export async function startTrayNavigation() {
  rememberCurrentTrayTarget();
  window.addEventListener('hashchange', rememberCurrentTrayTarget);

  const cleanupHashListener = () => {
    window.removeEventListener('hashchange', rememberCurrentTrayTarget);
  };

  if (!isTauri()) return cleanupHashListener;

  try {
    const unlisten = await listen('one:tray-navigation', (event) => {
      applyTrayNavigation(event.payload);
    });

    return () => {
      cleanupHashListener();
      unlisten();
    };
  } catch {
    return cleanupHashListener;
  }
}
