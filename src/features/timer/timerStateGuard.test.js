import { describe, expect, it } from 'vitest';
import { timerStateGuard } from './timerStateGuard.js';

function state(overrides = {}) {
  return {
    selectedMinutes: 25,
    remainingSeconds: 1500,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
    ...overrides,
  };
}

describe('timerStateGuard', () => {
  it('保存契約の上限と対応時間を公開する', () => {
    expect(timerStateGuard.maxBytes).toBe(10_000);
    expect(timerStateGuard.minMinutes).toBe(1);
    expect(timerStateGuard.maxMinutes).toBe(180);
  });

  it('1〜180分の有効な状態を読み込める', () => {
    [1, 37, 180].forEach((selectedMinutes) => {
      const value = state({ selectedMinutes, remainingSeconds: selectedMinutes * 60 });
      expect(timerStateGuard.parse(JSON.stringify(value))).toEqual(value);
    });
  });

  it('実行中状態は安全な終了時刻と正の残り時間を要求する', () => {
    const running = state({ running: true, endAt: Date.now() + 60_000, remainingSeconds: 60 });
    expect(timerStateGuard.parse(JSON.stringify(running))).toEqual(running);
    expect(timerStateGuard.parse(JSON.stringify({ ...running, endAt: null }))).toBeNull();
    expect(timerStateGuard.parse(JSON.stringify({ ...running, remainingSeconds: 0 }))).toBeNull();
    expect(timerStateGuard.parse(JSON.stringify({ ...running, completionReady: true }))).toBeNull();
  });

  it('完了状態の残り時間と完了日を整合させる', () => {
    const completed = state({ remainingSeconds: 0, completionReady: true, completionDate: '2026-09-13' });
    expect(timerStateGuard.parse(JSON.stringify(completed))).toEqual(completed);
    expect(timerStateGuard.parse(JSON.stringify({ ...completed, remainingSeconds: 1 }))).toBeNull();
    expect(timerStateGuard.parse(JSON.stringify({ ...completed, completionDate: '2026-02-30' }))).toBeNull();
    expect(timerStateGuard.parse(JSON.stringify({ ...completed, completionReady: false }))).toBeNull();
  });

  it('旧形式の完了状態を互換読込し、未知フィールドは捨てる', () => {
    const legacy = { selectedMinutes: 25, remainingSeconds: 0, running: false, endAt: null };
    expect(timerStateGuard.parse(JSON.stringify(legacy))).toEqual(legacy);
    expect(timerStateGuard.parse(JSON.stringify({ ...legacy, futureField: 'ignored' }))).toEqual(legacy);
  });

  it('不正な型・範囲・JSONを拒否する', () => {
    const invalidStates = [
      state({ selectedMinutes: 0 }), state({ selectedMinutes: 181 }), state({ selectedMinutes: '25' }),
      state({ remainingSeconds: -1 }), state({ remainingSeconds: 1501 }), state({ running: 'false' }), [], null,
    ];
    invalidStates.forEach((value) => expect(timerStateGuard.parse(JSON.stringify(value))).toBeNull());
    expect(timerStateGuard.parse('{not-json')).toBeNull();
    expect(timerStateGuard.parse('')).toBeNull();
  });

  it('サイズ上限を超える入力を拒否する', () => {
    expect(timerStateGuard.parse('x'.repeat(timerStateGuard.maxBytes + 1))).toBeNull();
  });
});
