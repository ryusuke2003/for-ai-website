import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function idleTimerState(minutes) {
  return {
    selectedMinutes: minutes,
    remainingSeconds: minutes * 60,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
  };
}

describe('idle timer cross-tab sync', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('StorageEventのアイドル状態をtimerStoreと自由設定UIへ反映し、書き戻さない', async () => {
    const { getTimerSnapshot } = await import('./timerStore.js');
    const { useCustomTimerControl } = await import('./useCustomTimerControl.js');

    const initial = getTimerSnapshot();
    const { result } = renderHook(() => useCustomTimerControl(initial.selectedMinutes, false));

    const remoteState = idleTimerState(45);
    const remoteRaw = JSON.stringify(remoteState);
    localStorage.setItem('one.timer.v1', remoteRaw);

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockClear();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.timer.v1',
        newValue: remoteRaw,
        storageArea: localStorage,
      }));
    });

    await waitFor(() => expect(getTimerSnapshot().selectedMinutes).toBe(45));
    expect(getTimerSnapshot().remainingSeconds).toBe(45 * 60);
    expect(result.current.value).toBe('45');
    expect(result.current.status).toContain('別のタブで45分に変更されました');
    expect(setItem).not.toHaveBeenCalled();

    setItem.mockRestore();
  });

  it('実行中・完了待ち・途中経過の保存状態はアイドル同期しない', async () => {
    const { getTimerSnapshot } = await import('./timerStore.js');
    const initialMinutes = getTimerSnapshot().selectedMinutes;

    const invalidForIdleSync = [
      {
        selectedMinutes: 40,
        remainingSeconds: 40 * 60,
        running: true,
        endAt: Date.now() + 40 * 60 * 1000,
        completionReady: false,
        completionDate: null,
      },
      {
        selectedMinutes: 40,
        remainingSeconds: 0,
        running: false,
        endAt: null,
        completionReady: true,
        completionDate: '2026-09-13',
      },
      {
        selectedMinutes: 40,
        remainingSeconds: 1200,
        running: false,
        endAt: null,
        completionReady: false,
        completionDate: null,
      },
    ];

    invalidForIdleSync.forEach((state) => {
      const raw = JSON.stringify(state);
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'one.timer.v1',
          newValue: raw,
          storageArea: localStorage,
        }));
      });
    });

    expect(getTimerSnapshot().selectedMinutes).toBe(initialMinutes);
  });
});
