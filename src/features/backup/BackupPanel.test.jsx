import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel } from './BackupPanel.jsx';

const controls = vi.hoisted(() => ({
  backup: {
    backupStatus: 'バックアップ待機中',
    importDisabled: false,
    undoHidden: false,
    undoDisabled: false,
    exportBackup: vi.fn(),
    importBackup: vi.fn(async () => false),
    undoLastRestore: vi.fn(() => false),
  },
  reset: {
    resetButtonHidden: false,
    resetConfirmHidden: false,
    resetConfirmDisabled: false,
    resetCancelDisabled: false,
    resetStatus: '削除待機中',
    openReset: vi.fn(),
    confirmReset: vi.fn(),
    cancelReset: vi.fn(),
  },
}));

vi.mock('./useBackupControl.js', () => ({
  useBackupControl: () => controls.backup,
}));

vi.mock('./usePrivacyResetControl.js', () => ({
  usePrivacyResetControl: () => controls.reset,
}));

describe('BackupPanel', () => {
  beforeEach(() => {
    Object.values(controls.backup).forEach((value) => value?.mockClear?.());
    Object.values(controls.reset).forEach((value) => value?.mockClear?.());
  });

  it('バックアップとデータ削除の操作・status要素を表示する', () => {
    render(<BackupPanel />);

    expect(document.getElementById('backup-export-button')).not.toBeNull();
    expect(document.getElementById('backup-import-button')).not.toBeNull();
    expect(document.getElementById('backup-undo-button')).not.toBeNull();
    expect(document.getElementById('data-reset-button')).not.toBeNull();
    expect(document.getElementById('data-reset-confirm-button')).not.toBeNull();
    expect(document.getElementById('data-reset-cancel-button')).not.toBeNull();

    const backupStatus = document.getElementById('backup-status');
    const resetStatus = document.getElementById('data-reset-status');
    expect(backupStatus.getAttribute('role')).toBe('status');
    expect(backupStatus.getAttribute('aria-live')).toBe('polite');
    expect(backupStatus.textContent).toBe('バックアップ待機中');
    expect(resetStatus.getAttribute('role')).toBe('status');
    expect(resetStatus.getAttribute('aria-live')).toBe('polite');
    expect(resetStatus.textContent).toBe('削除待機中');
  });

  it('主要ボタン操作を各controlへ委譲する', () => {
    render(<BackupPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'JSONを書き出す' }));
    fireEvent.click(screen.getByRole('button', { name: '直前の復元を取り消す' }));
    fireEvent.click(screen.getByRole('button', { name: 'この端末のデータを削除' }));
    fireEvent.click(screen.getByRole('button', { name: '本当にすべて削除' }));
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(controls.backup.exportBackup).toHaveBeenCalledOnce();
    expect(controls.backup.undoLastRestore).toHaveBeenCalledOnce();
    expect(controls.reset.openReset).toHaveBeenCalledOnce();
    expect(controls.reset.confirmReset).toHaveBeenCalledOnce();
    expect(controls.reset.cancelReset).toHaveBeenCalledOnce();
  });
});
