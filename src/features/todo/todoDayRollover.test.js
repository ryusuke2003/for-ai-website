import { beforeEach, describe, expect, it } from 'vitest';
import {
  TODO_DAY_STORAGE_KEY,
  rolloverTodoDayIfNeeded,
  todoDayKey,
} from './todoDayRollover.js';
import {
  LEGACY_TODO_STORAGE_KEY,
  TODO_RESET_BACKUP_KEY,
  TODO_STORAGE_KEY,
} from './resetTodoSchedule.js';

describe('todoDayRollover', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ローカル日付を YYYY-MM-DD 形式で返す', () => {
    expect(todoDayKey(new Date(2026, 8, 15, 23, 59))).toBe('2026-09-15');
  });

  it('初回導入時は既存Todoを消さずに当日を記録する', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([{ id: 'keep-me' }]));

    expect(rolloverTodoDayIfNeeded(localStorage, new Date(2026, 8, 15, 12, 0))).toBe(false);
    expect(localStorage.getItem(TODO_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(TODO_DAY_STORAGE_KEY)).toBe('2026-09-15');
  });

  it('同じ日なら予定をそのまま残す', () => {
    localStorage.setItem(TODO_DAY_STORAGE_KEY, '2026-09-15');
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([{ id: 'today' }]));

    expect(rolloverTodoDayIfNeeded(localStorage, new Date(2026, 8, 15, 23, 59))).toBe(false);
    expect(localStorage.getItem(TODO_STORAGE_KEY)).not.toBeNull();
  });

  it('日付が変わったらTodoとリセット用バックアップを消す', () => {
    localStorage.setItem(TODO_DAY_STORAGE_KEY, '2026-09-15');
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([{ id: 'yesterday' }]));
    localStorage.setItem(LEGACY_TODO_STORAGE_KEY, JSON.stringify([{ id: 'legacy' }]));
    localStorage.setItem(TODO_RESET_BACKUP_KEY, JSON.stringify({ current: '[]', legacy: null }));

    expect(rolloverTodoDayIfNeeded(localStorage, new Date(2026, 8, 16, 0, 1))).toBe(true);
    expect(localStorage.getItem(TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TODO_RESET_BACKUP_KEY)).toBeNull();
    expect(localStorage.getItem(TODO_DAY_STORAGE_KEY)).toBe('2026-09-16');
  });
});
