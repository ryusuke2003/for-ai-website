import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageHealthStatus } from './StorageHealthStatus.jsx';

const LEGACY_TASK_STORAGE_KEYS = ['one.task', 'one.taskDate.v1'];

describe('StorageHealthStatus', () => {
  it('localStorageが利用できると利用可能を表示しlegacyタスクを削除する', async () => {
    LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, 'legacy'));

    render(<StorageHealthStatus />);

    const status = screen.getByRole('status');
    expect(status.id).toBe('storage-health-status');
    expect(status.getAttribute('aria-live')).toBe('polite');

    await waitFor(() => {
      expect(status.dataset.state).toBe('available');
      expect(status.textContent).toContain('端末保存: 利用できます');
    });

    LEGACY_TASK_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
  });

  it('storage errorイベントを受けると利用不可へ切り替える', async () => {
    render(<StorageHealthStatus />);
    const status = screen.getByRole('status');

    await waitFor(() => expect(status.dataset.state).toBe('available'));

    act(() => {
      window.dispatchEvent(new Event('one:storage-error'));
    });

    await waitFor(() => {
      expect(status.dataset.state).toBe('unavailable');
      expect(status.textContent).toContain('端末保存を利用できません');
    });
  });
});
