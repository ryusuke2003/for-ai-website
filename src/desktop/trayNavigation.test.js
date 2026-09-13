import { describe, expect, it } from 'vitest';
import { applyTrayNavigation } from './trayNavigation.js';

describe('applyTrayNavigation', () => {
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

  it('未対応の遷移先は無視する', () => {
    window.location.hash = '';

    expect(applyTrayNavigation('settings')).toBe(false);
    expect(window.location.hash).toBe('');
  });
});
