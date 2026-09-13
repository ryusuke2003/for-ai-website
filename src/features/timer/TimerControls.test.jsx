import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timerActions } from './timerStore.js';
import { useTimerState } from './useTimerState.js';
import { TimerControls } from './TimerControls.jsx';

vi.mock('./timerStore.js', () => ({
  timerActions: {
    toggle: vi.fn(),
    reset: vi.fn(),
    canRestoreReset: vi.fn(),
    restoreReset: vi.fn(),
  },
}));

vi.mock('./useTimerState.js', () => ({
  useTimerState: vi.fn(),
}));

function state(overrides = {}) {
  return {
    running: false,
    completionReady: false,
    selectedMinutes: 25,
    remainingSeconds: 25 * 60,
    ...overrides,
  };
}

describe('TimerControls', () => {
  beforeEach(() => {
    vi.mocked(timerActions.toggle).mockReset();
    vi.mocked(timerActions.reset).mockReset();
    vi.mocked(timerActions.restoreReset).mockReset();
    vi.mocked(timerActions.canRestoreReset).mockReset();
    vi.mocked(timerActions.canRestoreReset).mockReturnValue(false);
    vi.mocked(useTimerState).mockReturnValue(state());
  });

  it('開始・リセット・復元・集中表示を利用者向けラベルとショートカット情報付きで表示する', () => {
    render(<TimerControls focusModeActive={false} onToggleFocusMode={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'スタート' }).getAttribute('aria-keyshortcuts')).toBe('Space');
    expect(screen.getByRole('button', { name: '集中表示に切り替える' }).getAttribute('aria-keyshortcuts')).toBe('F Escape');
    expect(screen.getByRole('button', { name: 'リセット' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '復元' }).disabled).toBe(true);
  });

  it('開始とリセットはtimerActionsを直接呼ぶ', () => {
    render(<TimerControls focusModeActive={false} onToggleFocusMode={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'スタート' }));
    fireEvent.click(screen.getByRole('button', { name: 'リセット' }));

    expect(timerActions.toggle).toHaveBeenCalledOnce();
    expect(timerActions.reset).toHaveBeenCalledOnce();
  });

  it('リセット前の状態があるときだけ復元できる', () => {
    vi.mocked(timerActions.canRestoreReset).mockReturnValue(true);
    render(<TimerControls focusModeActive={false} onToggleFocusMode={vi.fn()} />);

    const restoreButton = screen.getByRole('button', { name: '復元' });
    expect(restoreButton.disabled).toBe(false);
    fireEvent.click(restoreButton);
    expect(timerActions.restoreReset).toHaveBeenCalledOnce();
  });

  it('一時停止中は再開、実行中は一時停止と表示する', () => {
    vi.mocked(useTimerState).mockReturnValue(state({ remainingSeconds: 600 }));
    const { rerender } = render(<TimerControls focusModeActive={false} onToggleFocusMode={vi.fn()} />);
    expect(screen.getByRole('button', { name: '再開' })).not.toBeNull();

    vi.mocked(useTimerState).mockReturnValue(state({ running: true, remainingSeconds: 600 }));
    rerender(<TimerControls focusModeActive={false} onToggleFocusMode={vi.fn()} />);
    expect(screen.getByRole('button', { name: '一時停止' })).not.toBeNull();
  });

  it('未記録完了中は開始・リセット・復元を無効化する', () => {
    vi.mocked(timerActions.canRestoreReset).mockReturnValue(true);
    vi.mocked(useTimerState).mockReturnValue(state({ completionReady: true, remainingSeconds: 0 }));
    render(<TimerControls focusModeActive={false} onToggleFocusMode={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'もう一度' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'リセット' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '復元' }).disabled).toBe(true);
  });
});
