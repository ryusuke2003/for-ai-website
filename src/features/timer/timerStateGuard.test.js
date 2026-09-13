import { describe, expect, it } from 'vitest';
import { timerStateGuard as guard } from './timerStateGuard.js';

describe('timerStateGuard', () => {
  it('保存契約の境界値と通常状態を受け入れる', () => {
    expect(guard.maxBytes).toBe(10_000);
    expect(guard.minMinutes).toBe(1);
    expect(guard.maxMinutes).toBe(180);

    const currentState = {
      selectedMinutes: 25,
      remainingSeconds: 1500,
      running: true,
      endAt: Date.now() + 1_500_000,
      completionReady: false,
      completionDate: null,
    };
    expect(guard.parse(JSON.stringify(currentState))).toEqual(currentState);

    const customDurationState = {
      selectedMinutes: 37,
      remainingSeconds: 37 * 60,
      running: false,
      endAt: null,
      completionReady: false,
      completionDate: null,
    };
    expect(guard.parse(JSON.stringify(customDurationState))).toEqual(customDurationState);

    for (const selectedMinutes of [1, 180]) {
      const state = {
        selectedMinutes,
        remainingSeconds: selectedMinutes * 60,
        running: false,
        endAt: null,
        completionReady: false,
        completionDate: null,
      };
      expect(guard.parse(JSON.stringify(state))).toEqual(state);
    }
  });

  it('旧形式の完了状態は互換性のため読み取れる', () => {
    const legacyCompletedState = {
      selectedMinutes: 25,
      remainingSeconds: 0,
      running: false,
      endAt: null,
    };
    expect(guard.parse(JSON.stringify(legacyCompletedState))).toEqual(legacyCompletedState);

    const legacyPendingCompletion = {
      ...legacyCompletedState,
      completionReady: true,
    };
    expect(guard.parse(JSON.stringify(legacyPendingCompletion))).toEqual(legacyPendingCompletion);
  });

  it('未知キーは保存契約へ持ち込まず無視する', () => {
    const state = {
      selectedMinutes: 25,
      remainingSeconds: 1500,
      running: false,
      endAt: null,
      completionReady: false,
      completionDate: null,
      futureField: 'ignored',
    };

    expect(guard.parse(JSON.stringify(state))).toEqual({
      selectedMinutes: 25,
      remainingSeconds: 1500,
      running: false,
      endAt: null,
      completionReady: false,
      completionDate: null,
    });
  });

  it('型・範囲・完了状態が不正な保存値を拒否する', () => {
    const currentState = {
      selectedMinutes: 25,
      remainingSeconds: 1500,
      running: true,
      endAt: Date.now() + 1_500_000,
      completionReady: false,
      completionDate: null,
    };
    const invalidStates = [
      { ...currentState, selectedMinutes: '25' },
      { ...currentState, selectedMinutes: 0 },
      { ...currentState, selectedMinutes: 181 },
      { ...currentState, remainingSeconds: '1500' },
      { ...currentState, remainingSeconds: 1501 },
      { ...currentState, running: 'true' },
      { ...currentState, endAt: null },
      { ...currentState, remainingSeconds: 0 },
      { ...currentState, completionReady: true },
      {
        selectedMinutes: 25,
        remainingSeconds: 120,
        running: false,
        endAt: null,
        completionReady: true,
        completionDate: '2026-09-07',
      },
      {
        selectedMinutes: 25,
        remainingSeconds: 0,
        running: false,
        endAt: null,
        completionReady: false,
        completionDate: '2026-09-07',
      },
      {
        selectedMinutes: 25,
        remainingSeconds: 0,
        running: false,
        endAt: null,
        completionDate: '2026-09-07',
      },
      {
        selectedMinutes: 25,
        remainingSeconds: 0,
        running: false,
        endAt: null,
        completionReady: true,
        completionDate: '2026-02-30',
      },
    ];

    invalidStates.forEach((state) => {
      expect(guard.parse(JSON.stringify(state))).toBeNull();
    });
  });

  it('壊れたJSON・空文字・上限超過を拒否する', () => {
    expect(guard.parse('{not-json')).toBeNull();
    expect(guard.parse('')).toBeNull();
    expect(guard.parse('x'.repeat(guard.maxBytes + 1))).toBeNull();
  });
});
