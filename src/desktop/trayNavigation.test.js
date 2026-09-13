import { describe, expect, it } from 'vitest';
import { applyTrayNavigation } from './trayNavigation.js';

describe('applyTrayNavigation', () => {
  it('todo指定でTodo画面のhashへ遷移する', () => {
    window.location.hash = '';

    expect(applyTrayNavigation('todo')).toBe(true);
    expect(window.location.hash).toBe('#todo');
  });

  it('未対応の遷移先は無視する', () => {
    window.location.hash = '';

    expect(applyTrayNavigation('settings')).toBe(false);
    expect(window.location.hash).toBe('');
  });
});
