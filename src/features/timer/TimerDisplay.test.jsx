import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerState } from './useTimerState.js';
import { TimerDisplay } from './TimerDisplay.jsx';

vi.mock('./useTimerState.js', () => ({ useTimerState: vi.fn() }));

function state(overrides = {}) {
  return {
    selectedMinutes: 25,
    remainingSeconds: 1500,
    running: false,
    endAt: null,
    completionReady: false,
    feedback: '準備できたらスタート。',
    ...overrides,
  };
}

describe('TimerDisplay', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(useTimerState).mockReturnValue(state());
    document.title = 'before';
  });

  it('経過時間をprogress要素とアクセシブルな割合で表示する', () => {
    vi.mocked(useTimerState).mockReturnValue(state({ remainingSeconds: 900 }));
    render(<TimerDisplay />);
    const progress = screen.getByRole('progressbar', { name: '集中時間の進捗' });
    expect(progress.value).toBe(600);
    expect(progress.max).toBe(1500);
    expect(progress.getAttribute('aria-valuetext')).toBe('40%');
    expect(progress.hasAttribute('aria-live')).toBe(false);
  });

  it('実行中・一時停止・完了をdocument titleへ反映する', () => {
    vi.mocked(useTimerState).mockReturnValue(state({ running: true, remainingSeconds: 1472 }));
    const { rerender } = render(<TimerDisplay />);
    expect(document.title).toBe('24:32 — ONE');

    vi.mocked(useTimerState).mockReturnValue(state({ remainingSeconds: 1472 }));
    rerender(<TimerDisplay />);
    expect(document.title).toBe('24:32 一時停止 — ONE');

    vi.mocked(useTimerState).mockReturnValue(state({ completionReady: true, remainingSeconds: 0 }));
    rerender(<TimerDisplay />);
    expect(document.title).toBe('完了！ — ONE');
  });

  it('実行中は終了予定をtime要素で機械可読に表示する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T12:00:00+09:00'));
    const endAt = new Date('2026-09-13T12:25:00+09:00').getTime();
    vi.mocked(useTimerState).mockReturnValue(state({ running: true, endAt }));
    render(<TimerDisplay />);
    const time = document.querySelector('#timer-end-at');
    expect(time.dateTime).toBe(new Date(endAt).toISOString());
    expect(time.textContent).toMatch(/12:25/);
    expect(document.querySelector('#timer-end-time').hidden).toBe(false);
  });

  it('停止中は終了予定を隠す', () => {
    render(<TimerDisplay />);
    expect(document.querySelector('#timer-end-time').hidden).toBe(true);
  });
});
