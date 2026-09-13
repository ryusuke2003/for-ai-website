import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('timer reset restore', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T00:00:00+09:00'));
  });

  it('実行中にリセットした場合は直前の残り時間へ戻して再開できる', async () => {
    const { getTimerSnapshot, timerActions } = await import('./timerStore.js');

    expect(timerActions.canRestoreReset()).toBe(false);
    expect(timerActions.toggle()).toBe(true);
    vi.advanceTimersByTime(5 * 60 * 1000);

    const beforeReset = getTimerSnapshot();
    expect(beforeReset.running).toBe(true);
    expect(beforeReset.remainingSeconds).toBe(20 * 60);

    expect(timerActions.reset()).toBe(true);
    expect(getTimerSnapshot().running).toBe(false);
    expect(getTimerSnapshot().remainingSeconds).toBe(25 * 60);
    expect(timerActions.canRestoreReset()).toBe(true);

    expect(timerActions.restoreReset()).toBe(true);
    const restored = getTimerSnapshot();
    expect(restored.running).toBe(true);
    expect(restored.remainingSeconds).toBe(20 * 60);
    expect(restored.endAt).toBe(Date.now() + 20 * 60 * 1000);
    expect(restored.feedback).toContain('リセット前の残り時間を復元');
    expect(timerActions.canRestoreReset()).toBe(false);
  });

  it('リセット後に新しく開始したら古い復元候補は破棄する', async () => {
    const { timerActions } = await import('./timerStore.js');

    timerActions.toggle();
    vi.advanceTimersByTime(60_000);
    timerActions.reset();
    expect(timerActions.canRestoreReset()).toBe(true);

    timerActions.toggle();
    expect(timerActions.canRestoreReset()).toBe(false);
    expect(timerActions.restoreReset()).toBe(false);
  });
});
