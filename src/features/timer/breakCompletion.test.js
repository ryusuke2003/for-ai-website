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

function pendingCompletion(minutes) {
  return {
    selectedMinutes: minutes,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionReady: true,
    completionDate: dateKey(),
  };
}

async function loadPendingCompletion(minutes, doneCount = 3) {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(pendingCompletion(minutes)));
  localStorage.setItem(DONE_COUNT_STORAGE_KEY, String(doneCount));
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ [dateKey()]: 1 }));

  const timerStore = await import('./timerStore.js');
  const progressStore = await import('../progress/progressStore.js');
  return { timerStore, progressStore };
}

describe('5分休憩の完了処理', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('5分完了を終了しても集中回数に加算されない', async () => {
    const { progressStore } = await loadPendingCompletion(5, 3);

    expect(progressStore.progressActions.discard()).toBe(true);
    expect(progressStore.getProgressSnapshot().doneCount).toBe('3');
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('3');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))).toEqual({ [dateKey()]: 1 });
  });

  it('休憩を終了するとcompletionだけを消費して5分待機へ戻る', async () => {
    const { timerStore, progressStore } = await loadPendingCompletion(5, 7);

    expect(timerStore.getTimerSnapshot().completionReady).toBe(true);
    expect(progressStore.progressActions.discard()).toBe(true);

    const snapshot = timerStore.getTimerSnapshot();
    expect(snapshot).toMatchObject({
      selectedMinutes: 5,
      remainingSeconds: 300,
      running: false,
      endAt: null,
      completionReady: false,
      completionDate: null,
    });
    expect(progressStore.getProgressSnapshot().doneCount).toBe('7');
  });

  it.each([25, 50])('%i分完了は従来どおり1回記録する', async (minutes) => {
    const { timerStore, progressStore } = await loadPendingCompletion(minutes, 10);

    expect(progressStore.progressActions.record()).toBe(true);
    expect(progressStore.getProgressSnapshot().doneCount).toBe('11');
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('11');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))[dateKey()]).toBe(2);
    expect(timerStore.getTimerSnapshot()).toMatchObject({
      selectedMinutes: minutes,
      remainingSeconds: minutes * 60,
      completionReady: false,
      completionDate: null,
    });
  });
});
