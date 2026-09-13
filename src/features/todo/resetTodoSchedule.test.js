import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_TODO_STORAGE_KEY,
  TODO_RESET_BACKUP_KEY,
  TODO_STORAGE_KEY,
  canRestoreTodoSchedule,
  resetTodoSchedule,
  restoreTodoSchedule,
} from './resetTodoSchedule.js';

const TEMPLATE_STORAGE_KEY = 'one.todoTemplates.v1';

describe('resetTodoSchedule', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('今日の予定だけを削除し、テンプレートは残して復元用スナップショットを保存する', () => {
    const current = JSON.stringify([{ id: 'today' }]);
    const legacy = JSON.stringify([{ id: 'legacy' }]);
    localStorage.setItem(TODO_STORAGE_KEY, current);
    localStorage.setItem(LEGACY_TODO_STORAGE_KEY, legacy);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify([{ id: 'template' }]));

    expect(resetTodoSchedule()).toBe(true);
    expect(localStorage.getItem(TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).not.toBeNull();
    expect(canRestoreTodoSchedule()).toBe(true);
    expect(JSON.parse(localStorage.getItem(TODO_RESET_BACKUP_KEY))).toEqual({ current, legacy });
  });

  it('リセットした予定を元の内容のまま復元できる', () => {
    const current = JSON.stringify([{ id: 'today', text: '勉強' }]);
    localStorage.setItem(TODO_STORAGE_KEY, current);

    expect(resetTodoSchedule()).toBe(true);
    expect(restoreTodoSchedule()).toBe(true);

    expect(localStorage.getItem(TODO_STORAGE_KEY)).toBe(current);
    expect(localStorage.getItem(TODO_RESET_BACKUP_KEY)).toBeNull();
    expect(canRestoreTodoSchedule()).toBe(false);
  });
});
