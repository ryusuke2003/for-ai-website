import { beforeEach, describe, expect, it } from 'vitest';
import { TODO_STORAGE_KEY } from './resetTodoSchedule.js';
import { TODO_DAY_STORAGE_KEY } from './todoDayRollover.js';
import { readTrayTodos } from './trayTodoStorage.js';

describe('readTrayTodos', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Tray Todoを開くとき日付が変わっていれば昨日の予定を消してから読み直す', () => {
    localStorage.setItem(TODO_DAY_STORAGE_KEY, '2026-09-17');
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      {
        id: 'yesterday',
        text: '昨日の予定',
        startMinute: 600,
        duration: 25,
      },
    ]));

    expect(readTrayTodos(localStorage, new Date(2026, 8, 18, 0, 1))).toEqual([]);
    expect(localStorage.getItem(TODO_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TODO_DAY_STORAGE_KEY)).toBe('2026-09-18');
  });

  it('同じ日のTodoは従来どおり読み込む', () => {
    localStorage.setItem(TODO_DAY_STORAGE_KEY, '2026-09-18');
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      {
        id: 'today',
        text: '今日の予定',
        completed: false,
        startMinute: 600,
        duration: 25,
      },
    ]));

    expect(readTrayTodos(localStorage, new Date(2026, 8, 18, 12, 0))).toEqual([
      {
        id: 'today',
        text: '今日の予定',
        completed: false,
        startMinute: 600,
        duration: 25,
      },
    ]);
  });
});
