import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TRAY_NAVIGATION_APPLIED_EVENT,
  applyTrayNavigation,
  readLastTrayTarget,
  rememberTrayTarget,
} from './trayNavigation.js';

describe('applyTrayNavigation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('通常画面とTray画面へ遷移できる', () => {
    expect(applyTrayNavigation('todo')).toBe(true);
    expect(window.location.hash).toBe('#todo');

    expect(applyTrayNavigation('tray-timer')).toBe(true);
    expect(window.location.hash).toBe('#tray-timer');

    expect(applyTrayNavigation('tray-todo')).toBe(true);
    expect(window.location.hash).toBe('#tray-todo');

    expect(applyTrayNavigation('timer')).toBe(true);
    expect(window.location.hash).toBe('');
  });

  it('最後に表示していたTray画面を記憶して再表示できる', () => {
    expect(rememberTrayTarget('tray-timer')).toBe(true);
    expect(readLastTrayTarget()).toBe('tray-timer');

    expect(applyTrayNavigation('tray-last')).toBe(true);
    expect(window.location.hash).toBe('#tray-timer');
  });

  it('記憶がない場合は従来どおりTray Todoを開く', () => {
    expect(readLastTrayTarget()).toBe('tray-todo');

    expect(applyTrayNavigation('tray-last')).toBe(true);
    expect(window.location.hash).toBe('#tray-todo');
  });

  it('同じTray Todoを再表示しても通知イベントを発火する', () => {
    window.location.hash = '#tray-todo';
    const listener = vi.fn();
    window.addEventListener(TRAY_NAVIGATION_APPLIED_EVENT, listener);

    expect(applyTrayNavigation('tray-todo')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toBe('tray-todo');

    window.removeEventListener(TRAY_NAVIGATION_APPLIED_EVENT, listener);
  });

  it('未対応の遷移先は無視する', () => {
    expect(applyTrayNavigation('settings')).toBe(false);
    expect(window.location.hash).toBe('');
  });
});
