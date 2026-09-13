import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DONE_COUNT_STORAGE_KEY = 'one.doneCount';
const HISTORY_STORAGE_KEY = 'one.history.v1';
const TIMER_STORAGE_KEY = 'one.timer.v1';
const RECOVERY_STORAGE_KEY = 'one.restoreRecovery.v1';

function timerState(selectedMinutes = 25, overrides = {}) {
  return {
    selectedMinutes,
    remainingSeconds: selectedMinutes * 60,
    running: false,
    endAt: null,
    completionReady: false,
    completionDate: null,
    ...overrides,
  };
}

function seedStoredState({
  doneCount = 3,
  history = { '2026-09-13': 2 },
  timer = timerState(25),
} = {}) {
  localStorage.setItem(DONE_COUNT_STORAGE_KEY, String(doneCount));
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
}

function backupPayload(data) {
  return JSON.stringify({
    format: 'one-focus-backup',
    version: 1,
    exportedAt: '2026-09-13T12:00:00.000Z',
    data,
  });
}

function fileLike(raw) {
  return {
    size: raw.length,
    text: async () => raw,
  };
}

async function loadBackupHook() {
  vi.resetModules();
  const { useBackupControl } = await import('./useBackupControl.js');
  return useBackupControl;
}

function installDownloadSpies() {
  let exportedBlob = null;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob) => {
      exportedBlob = blob;
      return 'blob:test-backup';
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return () => exportedBlob;
}

describe('useBackupControl', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('保存中の累計・履歴・タイマー時間をJSONへ書き出す', async () => {
    seedStoredState({
      doneCount: 4,
      history: { '2026-09-13': 2, '2026-09-12': 1 },
      timer: timerState(50),
    });
    const getExportedBlob = installDownloadSpies();
    const useBackupControl = await loadBackupHook();
    const { result } = renderHook(() => useBackupControl());

    let exported;
    act(() => {
      exported = result.current.exportBackup();
    });

    expect(exported).toBe(true);
    expect(result.current.backupStatus).toContain('バックアップを書き出しました');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();

    const blob = getExportedBlob();
    expect(blob).not.toBeNull();
    const payload = JSON.parse(await blob.text());
    expect(payload.format).toBe('one-focus-backup');
    expect(payload.version).toBe(1);
    expect(payload.data).toEqual({
      doneCount: 4,
      history: { '2026-09-13': 2, '2026-09-12': 1 },
      selectedMinutes: 50,
    });
  });

  it('localStorage読込が壊れてもReactの現在値から救出用JSONを書き出す', async () => {
    seedStoredState({
      doneCount: 6,
      history: { '2026-09-13': 3 },
      timer: timerState(25),
    });
    const getExportedBlob = installDownloadSpies();
    const useBackupControl = await loadBackupHook();
    const { result } = renderHook(() => useBackupControl());
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(key) {
      if ([DONE_COUNT_STORAGE_KEY, HISTORY_STORAGE_KEY, TIMER_STORAGE_KEY].includes(key)) {
        throw new DOMException('blocked', 'SecurityError');
      }
      return originalGetItem.call(this, key);
    });

    let exported;
    act(() => {
      exported = result.current.exportBackup();
    });

    expect(exported).toBe(true);
    expect(result.current.backupStatus).toContain('JSON書き出しだけ利用できます');
    const payload = JSON.parse(await getExportedBlob().text());
    expect(payload.data).toEqual({
      doneCount: 6,
      history: { '2026-09-13': 3 },
      selectedMinutes: 25,
    });
  });

  it('壊れたJSONは復元せず現在データを維持する', async () => {
    seedStoredState();
    const useBackupControl = await loadBackupHook();
    const { result } = renderHook(() => useBackupControl());
    await waitFor(() => expect(result.current.importDisabled).toBe(false));

    let restored;
    await act(async () => {
      restored = await result.current.importBackup(fileLike('{not-json'));
    });

    expect(restored).toBe(false);
    expect(result.current.backupStatus).toContain('JSONファイルを確認してください');
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('3');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))).toEqual({ '2026-09-13': 2 });
  });

  it('正常なバックアップを復元し、直前の状態へ1回だけUndoできる', async () => {
    seedStoredState({
      doneCount: 3,
      history: { '2026-09-13': 2 },
      timer: timerState(25),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const useBackupControl = await loadBackupHook();
    const { result } = renderHook(() => useBackupControl());
    await waitFor(() => expect(result.current.importDisabled).toBe(false));

    const raw = backupPayload({
      doneCount: 8,
      history: { '2026-09-13': 4, '2026-09-12': 2 },
      selectedMinutes: 50,
    });
    let restored;
    await act(async () => {
      restored = await result.current.importBackup(fileLike(raw));
    });

    expect(restored).toBe(true);
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('8');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))).toEqual({
      '2026-09-13': 4,
      '2026-09-12': 2,
    });
    expect(JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY)).selectedMinutes).toBe(50);
    expect(localStorage.getItem(RECOVERY_STORAGE_KEY)).not.toBeNull();
    expect(result.current.backupStatus).toContain('バックアップを復元しました');
    await waitFor(() => expect(result.current.undoHidden).toBe(false));

    let undone;
    act(() => {
      undone = result.current.undoLastRestore();
    });

    expect(undone).toBe(true);
    expect(localStorage.getItem(DONE_COUNT_STORAGE_KEY)).toBe('3');
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))).toEqual({ '2026-09-13': 2 });
    expect(JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY)).selectedMinutes).toBe(25);
    expect(localStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
    expect(result.current.backupStatus).toContain('復元前の記録へ戻しました');
  });
});

describe('BackupPanelの復元ボタン', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('タイマーがアイドルなら復元できる', async () => {
    seedStoredState();
    vi.resetModules();
    const { BackupPanel } = await import('./BackupPanel.jsx');
    render(<BackupPanel />);

    const restoreButton = screen.getByRole('button', { name: 'JSONから復元' });
    await waitFor(() => expect(restoreButton.disabled).toBe(false));
  });

  it('一時停止中のタイマーがあると復元を無効化する', async () => {
    seedStoredState({
      timer: timerState(25, { remainingSeconds: 1200 }),
    });
    vi.resetModules();
    const { BackupPanel } = await import('./BackupPanel.jsx');
    render(<BackupPanel />);

    const restoreButton = screen.getByRole('button', { name: 'JSONから復元' });
    expect(restoreButton.disabled).toBe(true);
    expect(await screen.findByText(/集中タイマーの進行中・一時停止中・未記録完了中は復元できません/)).toBeTruthy();
  });
});
