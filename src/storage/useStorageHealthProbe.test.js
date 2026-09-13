import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStorageHealthProbe } from './useStorageHealthProbe.js';

const LEGACY_TASK_STORAGE_KEYS = ['one.task', 'one.taskDate.v1'];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useStorageHealthProbe', () => {
  it('localStorageが利用できるとlegacyタスクだけを削除する', async () => {
    LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, 'legacy'));

    renderHook(() => useStorageHealthProbe());

    await waitFor(() => {
      LEGACY_TASK_STORAGE_KEYS.forEach((key) => {
        expect(localStorage.getItem(key)).toBeNull();
      });
    });
  });

  it('localStorageが利用できない場合はstorage errorイベントを通知する', async () => {
    const onStorageError = vi.fn();
    window.addEventListener('one:storage-error', onStorageError);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    renderHook(() => useStorageHealthProbe());

    await waitFor(() => expect(onStorageError).toHaveBeenCalledTimes(1));
    window.removeEventListener('one:storage-error', onStorageError);
  });
});
