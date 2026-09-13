import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';

describe('ThemeSwitcher', () => {
  it('テーマ変更をDOMとlocalStorageへ反映する', () => {
    render(<ThemeSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'ダーク' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('one.theme.v1')).toBe('dark');
    expect(screen.getByRole('button', { name: 'ダーク' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('表示テーマをダークにしました');
  });

  it('別タブ由来のstorageイベントへ追従する', () => {
    render(<ThemeSwitcher />);

    fireEvent(window, new StorageEvent('storage', {
      key: 'one.theme.v1',
      newValue: 'light',
      storageArea: localStorage,
    }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('button', { name: 'ライト' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('表示テーマをライトにしました');
  });

  it('不正なstorageイベントは無視する', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeSwitcher />);

    fireEvent(window, new StorageEvent('storage', {
      key: 'one.theme.v1',
      newValue: 'unknown',
      storageArea: localStorage,
    }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'ダーク' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('保存失敗時は画面反映を維持しつつ保存障害を通知する', () => {
    const storageFailure = vi.fn();
    globalThis.reportStorageFailure = storageFailure;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'ライト' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(storageFailure).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toContain('設定を保存できませんでした');

    setItem.mockRestore();
  });
});
