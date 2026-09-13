import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('timerStore restore', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T12:00:00+09:00'));
  });

  it('実行中の保存状態は終了時刻から残り時間を再計算して再開する', async () => {
    const endAt = Date.now() + 10 * 60 * 1000;
    localStorage.setItem('one.timer.v1', JSON.stringify({
      selectedMinutes: 25,
      remainingSeconds: 1200,
      running: true,
      endAt,
      completionReady: false,
      completionDate: null,
    }));
    const { getTimerSnapshot } = await import('./timerStore.js');
    const restored = getTimerSnapshot();
    expect(restored.running).toBe(true);
    expect(restored.endAt).toBe(endAt);
    expect(restored.remainingSeconds).toBe(600);
    expect(restored.completionReady).toBe(false);
    expect(restored.feedback).toContain('再読み込み前の続きから再開しました');
  });

  it('保存された終了時刻を過ぎていれば未記録完了として復元する', async () => {
    const endAt = Date.now() - 60_000;
    localStorage.setItem('one.timer.v1', JSON.stringify({
      selectedMinutes: 25,
      remainingSeconds: 30,
      running: true,
      endAt,
      completionReady: false,
      completionDate: null,
    }));
    const { getTimerSnapshot } = await import('./timerStore.js');
    const restored = getTimerSnapshot();
    expect(restored.running).toBe(false);
    expect(restored.remainingSeconds).toBe(0);
    expect(restored.endAt).toBeNull();
    expect(restored.completionReady).toBe(true);
    expect(restored.completionDate).toBe('2026-09-13');
  });

  it('旧形式の0秒保存状態は未記録完了として互換復元する', async () => {
    localStorage.setItem('one.timer.v1', JSON.stringify({
      selectedMinutes: 25,
      remainingSeconds: 0,
      running: false,
      endAt: null,
    }));
    const { getTimerSnapshot } = await import('./timerStore.js');
    const restored = getTimerSnapshot();
    expect(restored.completionReady).toBe(true);
    expect(restored.completionDate).toBe('2026-09-13');
    expect(restored.feedbackState).toBe('complete');
  });
});
