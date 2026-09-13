import { beforeEach, describe, expect, it, vi } from 'vitest';

const TIMER_STORAGE_KEY = 'one.timer.v1';
const DONE_COUNT_STORAGE_KEY = 'one.doneCount';
const HISTORY_STORAGE_KEY = 'one.history.v1';

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function pendingCompletion(minutes = 25) {
  return {
    selectedMinutes: minutes,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionReady: true,
    completionDate: dateKey(),
  };
}

async function loadStores({ doneCount = 2, historyCount = 1 } = {}) {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(pendingCompletion()));
  localStorage.setItem(DONE_COUNT_STORAGE_KEY, String(doneCount));
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ [dateKey()]: historyCount }));

  const timerStore = await import('./timerStore.js');
  const progressStore = await import('../progress/progressStore.js');
  return { timerStore, progressStore };
}

describe('完了記録の永続化', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('タイマー完了の消費を確定してから累計、履歴の順に保存する', async () => {
    const { progressStore } = await loadStores();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockClear();

    expect(progressStore.progressActions.record()).toBe(true);

    const persistedKeys = setItem.mock.calls.map(([key]) => key);
    const timerIndex = persistedKeys.indexOf(TIMER_STORAGE_KEY);
    const countIndex = persistedKeys.indexOf(DONE_COUNT_STORAGE_KEY);
    const historyIndex = persistedKeys.indexOf(HISTORY_STORAGE_KEY);

    expect(timerIndex).toBeGreaterThanOrEqual(0);
    expect(countIndex).toBeGreaterThan(timerIndex);
    expect(historyIndex).toBeGreaterThan(countIndex);
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('3');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))[dateKey()]).toBe(2);
  });

  it('タイマー完了の保存確認に失敗してもインメモリ記録を残し、進捗は永続化しない', async () => {
    const { timerStore, progressStore } = await loadStores();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      if (key === TIMER_STORAGE_KEY) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    expect(progressStore.progressActions.record()).toBe(true);
    expect(timerStore.getTimerSnapshot().completionReady).toBe(false);
    expect(progressStore.getProgressSnapshot().doneCount).toBe('3');
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('2');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))[dateKey()]).toBe(1);
    expect(timerStore.getTimerSnapshot().feedback).toContain('JSONを書き出す');
  });

  it('累計の保存確認に失敗したら日次履歴を永続化しない', async () => {
    const { progressStore } = await loadStores();
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function mockedSetItem(key, value) {
      if (key === DONE_COUNT_STORAGE_KEY) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    expect(progressStore.progressActions.record()).toBe(true);
    expect(progressStore.getProgressSnapshot().doneCount).toBe('3');
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('2');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))[dateKey()]).toBe(1);
    expect(setItem.mock.calls.some(([key]) => key === HISTORY_STORAGE_KEY)).toBe(false);
  });

  it('破棄時にタイマー保存を確認できない場合は再読込リスクを案内する', async () => {
    const { timerStore, progressStore } = await loadStores();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      if (key === TIMER_STORAGE_KEY) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    expect(progressStore.progressActions.discard()).toBe(true);
    expect(timerStore.getTimerSnapshot().completionReady).toBe(false);
    expect(JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY)).completionReady).toBe(true);
    expect(timerStore.getTimerSnapshot().feedback).toContain('未処理の完了として戻る可能性があります');
  });
});
