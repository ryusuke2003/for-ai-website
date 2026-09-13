import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timerActions } from './timerStore.js';
import { useTimerShortcuts } from './useTimerShortcuts.js';

vi.mock('./timerStore.js', () => ({
  timerActions: {
    toggle: vi.fn(),
  },
}));

function dispatchKey(init, target = document.body) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('useTimerShortcuts', () => {
  beforeEach(() => {
    vi.mocked(timerActions.toggle).mockReset();
  });

  it('Spaceでタイマーを開始・一時停止する', () => {
    const toggleFocusMode = vi.fn();
    renderHook(() => useTimerShortcuts(false, toggleFocusMode));

    const event = dispatchKey({ key: ' ', code: 'Space' });

    expect(timerActions.toggle).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(toggleFocusMode).not.toHaveBeenCalled();
  });

  it('Fで集中表示を切り替える', () => {
    const toggleFocusMode = vi.fn();
    renderHook(() => useTimerShortcuts(false, toggleFocusMode));

    const event = dispatchKey({ key: 'f', code: 'KeyF' });

    expect(toggleFocusMode).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(timerActions.toggle).not.toHaveBeenCalled();
  });

  it('入力要素、IME、修飾キー、キーリピートでは発火しない', () => {
    const toggleFocusMode = vi.fn();
    renderHook(() => useTimerShortcuts(false, toggleFocusMode));
    const input = document.createElement('input');
    document.body.appendChild(input);

    dispatchKey({ key: ' ', code: 'Space' }, input);
    dispatchKey({ key: 'Process', code: 'Space', isComposing: true });
    dispatchKey({ key: ' ', code: 'Space', repeat: true });
    dispatchKey({ key: 'f', code: 'KeyF', metaKey: true });

    expect(timerActions.toggle).not.toHaveBeenCalled();
    expect(toggleFocusMode).not.toHaveBeenCalled();
    input.remove();
  });

  it('集中表示中のEscapeは入力要素上でも解除を優先しフォーカス復帰を要求する', () => {
    const toggleFocusMode = vi.fn();
    const focusRequest = vi.fn();
    window.addEventListener('one:timer-controls-focus', focusRequest, { once: true });
    renderHook(() => useTimerShortcuts(true, toggleFocusMode));
    const button = document.createElement('button');
    document.body.appendChild(button);

    dispatchKey({ key: 'Escape', code: 'Escape' }, button);

    expect(toggleFocusMode).toHaveBeenCalledOnce();
    expect(focusRequest).toHaveBeenCalledOnce();
    const detail = focusRequest.mock.calls[0][0].detail;
    expect(detail).toEqual({ control: 'focus' });
    button.remove();
  });
});
