import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDailyGoalControl } from './useDailyGoalControl.js';

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('useDailyGoalControl', () => {
  it('1〜12回の目標を保存して進捗と読み上げを返す', () => {
    const { result } = renderHook(() => useDailyGoalControl(2));

    act(() => result.current.change('5'));
    act(() => result.current.apply());

    expect(JSON.parse(localStorage.getItem('one.dailyGoal.v1'))).toEqual({
      date: todayKey(),
      goal: 5,
    });
    expect(result.current.progressHidden).toBe(false);
    expect(result.current.progressMax).toBe(5);
    expect(result.current.progressValue).toBe(2);
    expect(result.current.status).toContain('あと3回');
    expect(result.current.todayAriaLabel).toContain('目標5回まであと3回');
  });

  it('範囲外の目標は保存せずinvalidにする', () => {
    const { result } = renderHook(() => useDailyGoalControl(0));

    act(() => result.current.change('13'));
    act(() => result.current.apply());

    expect(result.current.invalid).toBe(true);
    expect(result.current.status).toContain('1〜12回の整数');
    expect(localStorage.getItem('one.dailyGoal.v1')).toBeNull();
  });

  it('別タブのstorageイベントへ追従し、不正値は無視する', () => {
    const { result } = renderHook(() => useDailyGoalControl(4));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.dailyGoal.v1',
        newValue: JSON.stringify({ date: todayKey(), goal: 4 }),
        storageArea: localStorage,
      }));
    });

    expect(result.current.progressValue).toBe(4);
    expect(result.current.status).toContain('達成しました');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.dailyGoal.v1',
        newValue: JSON.stringify({ date: todayKey(), goal: 99 }),
        storageArea: localStorage,
      }));
    });

    expect(result.current.progressMax).toBe(4);
  });

  it('保存失敗時も現在タブの目標は反映しstorage-errorを通知する', () => {
    const storageError = vi.fn();
    window.addEventListener('one:storage-error', storageError);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderHook(() => useDailyGoalControl(1));
    act(() => result.current.change('3'));
    act(() => result.current.apply());

    expect(result.current.progressMax).toBe(3);
    expect(result.current.status).toContain('端末へ保存できませんでした');
    expect(storageError).toHaveBeenCalled();

    setItem.mockRestore();
    window.removeEventListener('one:storage-error', storageError);
  });
});
