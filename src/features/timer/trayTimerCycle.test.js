import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceTrayTimerAfterCompletion,
  TRAY_LAST_FOCUS_MINUTES_KEY,
} from './trayTimerCycle.js';

function completionState(selectedMinutes) {
  return {
    selectedMinutes,
    remainingSeconds: 0,
    running: false,
    endAt: null,
    completionReady: true,
    completionDate: '2026-09-14',
  };
}

function createActions() {
  return {
    record: vi.fn(() => true),
    discard: vi.fn(() => true),
    selectMinutes: vi.fn(() => true),
  };
}

describe('Trayタイマーの集中・休憩サイクル', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each([25, 50, 37])('%i分の集中完了後は5分休憩へ切り替える', (minutes) => {
    const actions = createActions();

    expect(advanceTrayTimerAfterCompletion(completionState(minutes), actions)).toBe(true);
    expect(actions.record).toHaveBeenCalledTimes(1);
    expect(actions.discard).not.toHaveBeenCalled();
    expect(actions.selectMinutes).toHaveBeenCalledWith(5);
    expect(localStorage.getItem(TRAY_LAST_FOCUS_MINUTES_KEY)).toBe(String(minutes));
  });

  it('5分休憩の完了後は直前の集中時間へ戻す', () => {
    const focusActions = createActions();
    const breakActions = createActions();

    expect(advanceTrayTimerAfterCompletion(completionState(42), focusActions)).toBe(true);
    expect(advanceTrayTimerAfterCompletion(completionState(5), breakActions)).toBe(true);

    expect(breakActions.record).not.toHaveBeenCalled();
    expect(breakActions.discard).toHaveBeenCalledTimes(1);
    expect(breakActions.selectMinutes).toHaveBeenCalledWith(42);
  });

  it('直前の集中時間が保存されていなければ25分へ戻す', () => {
    const actions = createActions();

    expect(advanceTrayTimerAfterCompletion(completionState(5), actions)).toBe(true);
    expect(actions.selectMinutes).toHaveBeenCalledWith(25);
  });

  it('未完了なら切り替えない', () => {
    const actions = createActions();

    expect(advanceTrayTimerAfterCompletion({ ...completionState(25), completionReady: false }, actions)).toBe(false);
    expect(actions.record).not.toHaveBeenCalled();
    expect(actions.discard).not.toHaveBeenCalled();
    expect(actions.selectMinutes).not.toHaveBeenCalled();
  });

  it('完了処理に失敗した場合は次の時間へ切り替えない', () => {
    const actions = createActions();
    actions.record.mockReturnValue(false);

    expect(advanceTrayTimerAfterCompletion(completionState(25), actions)).toBe(false);
    expect(actions.selectMinutes).not.toHaveBeenCalled();
  });
});
