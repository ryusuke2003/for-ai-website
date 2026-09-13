import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadProgressStore() {
  vi.resetModules();
  return import('./progressStore.js');
}

describe('progressStore storage behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('累計回数は正規化されたsafe integerだけを受け付ける', async () => {
    const { parseDoneCount } = await loadProgressStore();

    expect(parseDoneCount('0')).toBe(0);
    expect(parseDoneCount('42')).toBe(42);
    expect(parseDoneCount('01')).toBe(0);
    expect(parseDoneCount('-1')).toBe(0);
    expect(parseDoneCount('9007199254740992')).toBe(0);
    expect(parseDoneCount('9'.repeat(33))).toBe(0);
  });

  it('起動時に保存済みの累計と有効な履歴だけを復元する', async () => {
    localStorage.setItem('one.doneCount', '12');
    localStorage.setItem('one.history.v1', JSON.stringify({
      '2026-09-13': 3,
      '2026-09-12': 2,
      '2026-02-30': 9,
      invalid: 4,
    }));

    const { getProgressSnapshot } = await loadProgressStore();
    const snapshot = getProgressSnapshot();

    expect(snapshot.doneCount).toBe('12');
    expect(snapshot.history).toEqual({
      '2026-09-13': 3,
      '2026-09-12': 2,
    });
  });

  it('別タブのstorageイベントをstoreへ反映し、同期値を書き戻さない', async () => {
    const { getProgressSnapshot } = await loadProgressStore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockClear();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.doneCount',
        newValue: '7',
        storageArea: localStorage,
      }));
    });
    expect(getProgressSnapshot().doneCount).toBe('7');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.history.v1',
        newValue: JSON.stringify({ '2026-09-13': 4 }),
        storageArea: localStorage,
      }));
    });
    expect(getProgressSnapshot().history).toEqual({ '2026-09-13': 4 });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('不正な別タブ値は無視し、削除イベントは初期値へ同期する', async () => {
    localStorage.setItem('one.doneCount', '5');
    localStorage.setItem('one.history.v1', JSON.stringify({ '2026-09-13': 2 }));
    const { getProgressSnapshot } = await loadProgressStore();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.doneCount',
        newValue: '01',
        storageArea: localStorage,
      }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.history.v1',
        newValue: '[]',
        storageArea: localStorage,
      }));
    });
    expect(getProgressSnapshot().doneCount).toBe('5');
    expect(getProgressSnapshot().history).toEqual({ '2026-09-13': 2 });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.doneCount',
        newValue: null,
        storageArea: localStorage,
      }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.history.v1',
        newValue: null,
        storageArea: localStorage,
      }));
    });
    expect(getProgressSnapshot().doneCount).toBe('0');
    expect(getProgressSnapshot().history).toEqual({});
  });

  it('pageshowで保存値を再読込する', async () => {
    const { getProgressSnapshot } = await loadProgressStore();
    localStorage.setItem('one.doneCount', '9');
    localStorage.setItem('one.history.v1', JSON.stringify({ '2026-09-13': 1 }));

    act(() => {
      window.dispatchEvent(new Event('pageshow'));
    });

    expect(getProgressSnapshot().doneCount).toBe('9');
    expect(getProgressSnapshot().history).toEqual({ '2026-09-13': 1 });
  });
});
