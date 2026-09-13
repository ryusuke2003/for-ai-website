import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentMinuteOfDay, millisecondsUntilNextMinute, useCurrentMinute } from './useCurrentMinute.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('useCurrentMinute', () => {
  it('現在時刻を分へ変換する', () => {
    expect(currentMinuteOfDay(new Date(2026, 8, 14, 1, 35, 20))).toBe(95);
  });

  it('次の分境界までの待ち時間を返す', () => {
    expect(millisecondsUntilNextMinute(new Date(2026, 8, 14, 1, 30, 45, 250))).toBe(14_750);
  });

  it('Tray Todoを開きっぱなしでも分境界ごとに現在時刻を更新する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 1, 30, 30));

    const { result } = renderHook(() => useCurrentMinute());
    expect(result.current.currentMinute).toBe(90);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.currentMinute).toBe(91);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.currentMinute).toBe(92);
  });
});
