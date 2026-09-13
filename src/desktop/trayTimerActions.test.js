import { describe, expect, it, vi } from 'vitest';
import { applyTrayTimerAction } from './trayTimerActions.js';

function fakeActions() {
  return {
    toggle: vi.fn(() => true),
    reset: vi.fn(() => true),
    selectMinutes: vi.fn(() => true),
  };
}

describe('applyTrayTimerAction', () => {
  it('開始は停止中だけtoggleする', () => {
    const actions = fakeActions();

    expect(applyTrayTimerAction('start', {
      actions,
      snapshot: () => ({ running: false, completionReady: false }),
    })).toBe(true);
    expect(actions.toggle).toHaveBeenCalledOnce();
  });

  it('実行中の開始と停止中の一時停止は何もしない', () => {
    const actions = fakeActions();

    expect(applyTrayTimerAction('start', {
      actions,
      snapshot: () => ({ running: true, completionReady: false }),
    })).toBe(false);
    expect(applyTrayTimerAction('pause', {
      actions,
      snapshot: () => ({ running: false, completionReady: false }),
    })).toBe(false);
    expect(actions.toggle).not.toHaveBeenCalled();
  });

  it('一時停止とリセットを既存timerActionsへ委譲する', () => {
    const actions = fakeActions();

    expect(applyTrayTimerAction('pause', {
      actions,
      snapshot: () => ({ running: true, completionReady: false }),
    })).toBe(true);
    expect(applyTrayTimerAction('reset', {
      actions,
      snapshot: () => ({ running: false, completionReady: false }),
    })).toBe(true);

    expect(actions.toggle).toHaveBeenCalledOnce();
    expect(actions.reset).toHaveBeenCalledOnce();
  });

  it('25分開始は25分へ切り替えてから開始する', () => {
    const actions = fakeActions();

    expect(applyTrayTimerAction('start-25', {
      actions,
      snapshot: () => ({ running: false, completionReady: false }),
    })).toBe(true);

    expect(actions.selectMinutes).toHaveBeenCalledWith(25);
    expect(actions.toggle).toHaveBeenCalledOnce();
  });

  it('5分休憩は5分へ切り替えてから開始する', () => {
    const actions = fakeActions();

    expect(applyTrayTimerAction('break-5', {
      actions,
      snapshot: () => ({ running: false, completionReady: false }),
    })).toBe(true);

    expect(actions.selectMinutes).toHaveBeenCalledWith(5);
    expect(actions.toggle).toHaveBeenCalledOnce();
  });

  it('未処理の完了があると新しいタイマーを開始しない', () => {
    const actions = fakeActions();

    expect(applyTrayTimerAction('start-25', {
      actions,
      snapshot: () => ({ running: false, completionReady: true }),
    })).toBe(false);
    expect(applyTrayTimerAction('break-5', {
      actions,
      snapshot: () => ({ running: false, completionReady: true }),
    })).toBe(false);

    expect(actions.selectMinutes).not.toHaveBeenCalled();
    expect(actions.toggle).not.toHaveBeenCalled();
  });
});
