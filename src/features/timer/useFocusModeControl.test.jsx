import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusModeControl } from './useFocusModeControl.js';

describe('useFocusModeControl', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('focus-mode');
  });

  it('保存済みONを復元してbodyへ集中表示classを反映する', () => {
    localStorage.setItem('one.focusMode.v1', '1');

    const { result } = renderHook(() => useFocusModeControl(false));

    expect(result.current.active).toBe(true);
    expect(document.body.classList.contains('focus-mode')).toBe(true);
  });

  it('切替時に現在タブへ反映し、設定を保存する', () => {
    const { result } = renderHook(() => useFocusModeControl(false));

    act(() => result.current.toggle());
    expect(result.current.active).toBe(true);
    expect(localStorage.getItem('one.focusMode.v1')).toBe('1');
    expect(document.body.classList.contains('focus-mode')).toBe(true);
    expect(result.current.status).toContain('集中表示に切り替えました');

    act(() => result.current.toggle());
    expect(result.current.active).toBe(false);
    expect(localStorage.getItem('one.focusMode.v1')).toBe('0');
    expect(document.body.classList.contains('focus-mode')).toBe(false);
    expect(result.current.status).toContain('通常表示に戻りました');
  });

  it('保存失敗でも現在タブの表示は切り替える', () => {
    const storageError = vi.fn();
    window.addEventListener('one:storage-error', storageError, { once: true });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderHook(() => useFocusModeControl(false));
    act(() => result.current.toggle());

    expect(result.current.active).toBe(true);
    expect(document.body.classList.contains('focus-mode')).toBe(true);
    expect(result.current.status).toContain('設定を保存できませんでした');
    expect(storageError).toHaveBeenCalledOnce();

    setItem.mockRestore();
  });

  it('タイマー完了待ちになると集中表示を解除する', () => {
    localStorage.setItem('one.focusMode.v1', '1');
    const { result, rerender } = renderHook(({ completionReady }) => useFocusModeControl(completionReady), {
      initialProps: { completionReady: false },
    });

    expect(result.current.active).toBe(true);

    rerender({ completionReady: true });

    expect(result.current.active).toBe(false);
    expect(localStorage.getItem('one.focusMode.v1')).toBe('0');
    expect(document.body.classList.contains('focus-mode')).toBe(false);
  });
});
