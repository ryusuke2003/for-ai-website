import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function setVisibility(value) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('useWakeLockControl', () => {
  beforeEach(() => {
    vi.resetModules();
    setVisibility('visible');
  });

  it('利用者がONにすると保存し、タイマー開始中だけscreen lockを要求する', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const sentinel = {
      released: false,
      release,
      addEventListener: vi.fn(),
    };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });

    const { useWakeLockControl } = await import('./useWakeLockControl.js');
    const { result, rerender } = renderHook(({ running }) => useWakeLockControl(running), {
      initialProps: { running: false },
    });

    await act(async () => result.current.toggle());

    expect(result.current.pressed).toBe(true);
    expect(localStorage.getItem('one.wakeLock.v1')).toBe('1');
    expect(request).not.toHaveBeenCalled();

    rerender({ running: true });
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    await waitFor(() => expect(result.current.status).toContain('画面維持を有効'));
  });

  it('非表示では要求せず、表示中のlockはOFF時に解放する', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const sentinel = {
      released: false,
      release,
      addEventListener: vi.fn(),
    };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });

    const { useWakeLockControl } = await import('./useWakeLockControl.js');
    const { result } = renderHook(() => useWakeLockControl(true));

    setVisibility('hidden');
    await act(async () => result.current.toggle());
    expect(request).not.toHaveBeenCalled();

    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    await act(async () => result.current.toggle());
    expect(release).toHaveBeenCalled();
    expect(localStorage.getItem('one.wakeLock.v1')).toBe('0');
  });

  it('別タブのstorageイベントで設定を同期する', async () => {
    const request = vi.fn().mockResolvedValue({
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });

    const { useWakeLockControl } = await import('./useWakeLockControl.js');
    const { result } = renderHook(() => useWakeLockControl(false));

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.wakeLock.v1',
        newValue: '1',
        storageArea: localStorage,
      }));
    });

    expect(result.current.pressed).toBe(true);
    expect(result.current.status).toContain('別のタブで画面維持がオン');
  });
});
