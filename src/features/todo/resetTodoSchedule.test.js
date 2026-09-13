import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_TODO_STORAGE_KEY,
  TODO_STORAGE_KEY,
  resetTodoSchedule,
} from './resetTodoSchedule.js';

const TEMPLATE_STORAGE_KEY = 'one.todoTemplates.v1';

describe('resetTodoSchedule', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('今日の予定だけを削除し、テンプレートは残す', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([{ id: 'today' }]));
    localStorage.setItem(LEGACY_TODO_STORAGE_KEY, JSON.stringify([{ id: 'legacy' }]));
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify([{ id: 'template' }]));

    expect(resetTodoSchedule()).toBe(true);
    expect(localStorage.getItem(TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).not.toBeNull();
  });

  it('storage操作に失敗した場合はfalseを返す', () => {
    const brokenStorage = {
      removeItem() {
        throw new Error('storage unavailable');
      },
      getItem() {
        return null;
      },
    };

    expect(resetTodoSchedule(brokenStorage)).toBe(false);
  });
});
