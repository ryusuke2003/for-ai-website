import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrivacyResetControl } from './usePrivacyResetControl.js';

const KNOWN_KEYS = [
  'one.task',
  'one.doneCount',
  'one.timer.v1',
  'one.history.v1',
  'one.dailyGoal.v1',
  'one.focusMode.v1',
  'one.completionSound.v1',
  'one.wakeLock.v1',
  'one.theme.v1',
];

describe('usePrivacyResetControl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('確認UIを開いてキャンセルできる', () => {
    const { result } = renderHook(() => usePrivacyResetControl());

    act(() => result.current.openReset());
    expect(result.current.resetButtonHidden).toBe(true);
    expect(result.current.resetConfirmHidden).toBe(false);
    expect(result.current.resetStatus).toContain('元に戻せません');

    act(() => result.current.cancelReset());
    expect(result.current.resetButtonHidden).toBe(false);
    expect(result.current.resetConfirmHidden).toBe(true);
    expect(result.current.resetStatus).toContain('キャンセル');
  });

  it('削除ではONEの既知キーだけを消し、他のlocalStorageは残す', () => {
    KNOWN_KEYS.forEach((key) => localStorage.setItem(key, 'value'));
    localStorage.setItem('other.app.data', 'keep');
    const prepare = vi.fn();
    window.addEventListener('one:privacy-reset-prepare', prepare, { once: true });
    const { result } = renderHook(() => usePrivacyResetControl());

    let resetResult;
    act(() => {
      resetResult = result.current.confirmReset();
    });

    expect(resetResult).toBe(true);
    KNOWN_KEYS.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
    expect(localStorage.getItem('other.app.data')).toBe('keep');
    expect(localStorage.getItem('one.resetSignal.v1')).toBeNull();
    expect(prepare).toHaveBeenCalledOnce();
  });

  it('不正な別タブ削除通知は無視する', () => {
    localStorage.setItem('one.task', 'keep');
    renderHook(() => usePrivacyResetControl());

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.resetSignal.v1',
        newValue: 'invalid signal',
        storageArea: localStorage,
      }));
    });

    expect(localStorage.getItem('one.task')).toBe('keep');
  });

  it('有効な別タブ削除通知では通知キーを残したままONEデータを消す', () => {
    localStorage.setItem('one.task', 'remove');
    localStorage.setItem('one.doneCount', '3');
    localStorage.setItem('one.resetSignal.v1', 'seed-signal');
    localStorage.setItem('other.app.data', 'keep');
    renderHook(() => usePrivacyResetControl());

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.resetSignal.v1',
        newValue: 'mabc-0123456789abcdef',
        storageArea: localStorage,
      }));
    });

    expect(localStorage.getItem('one.task')).toBeNull();
    expect(localStorage.getItem('one.doneCount')).toBeNull();
    expect(localStorage.getItem('one.resetSignal.v1')).toBe('seed-signal');
    expect(localStorage.getItem('other.app.data')).toBe('keep');
  });

  it('localStorage削除例外を全体へ通知し、現在タブを再読み込みしない', () => {
    const storageError = vi.fn();
    window.addEventListener('one:storage-error', storageError, { once: true });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => usePrivacyResetControl());

    let resetResult;
    act(() => {
      resetResult = result.current.confirmReset();
    });

    expect(resetResult).toBe(false);
    expect(storageError).toHaveBeenCalledOnce();
    expect(result.current.resetStatus).toContain('削除できませんでした');
    removeItem.mockRestore();
  });
});
