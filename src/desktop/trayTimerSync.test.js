import { describe, expect, it } from 'vitest';
import { formatTrayTimerTitle } from './trayTimerSync.js';

describe('formatTrayTimerTitle', () => {
  it('実行中は残り時間を表示する', () => {
    expect(formatTrayTimerTitle({
      selectedMinutes: 25,
      remainingSeconds: 1472,
      running: true,
      completionReady: false,
    })).toBe('24:32');
  });

  it('一時停止中は停止記号と残り時間を表示する', () => {
    expect(formatTrayTimerTitle({
      selectedMinutes: 25,
      remainingSeconds: 1472,
      running: false,
      completionReady: false,
    })).toBe('⏸ 24:32');
  });

  it('待機中はONEを表示する', () => {
    expect(formatTrayTimerTitle({
      selectedMinutes: 25,
      remainingSeconds: 1500,
      running: false,
      completionReady: false,
    })).toBe('ONE');
  });

  it('完了時は00:00を表示する', () => {
    expect(formatTrayTimerTitle({
      selectedMinutes: 25,
      remainingSeconds: 0,
      running: false,
      completionReady: true,
    })).toBe('00:00');
  });
});
