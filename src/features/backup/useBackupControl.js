import { useEffect, useRef, useState } from 'react';
import { useProgressOverviewState } from '../progress/useProgressOverviewState.js';
import { timerActions } from '../timer/timerStore.js';
import { useTimerState } from '../timer/useTimerState.js';

const BACKUP_FORMAT = 'one-focus-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 100_000;
const RECOVERY_STORAGE_KEY = 'one.restoreRecovery.v1';
const RECOVERY_FORMAT = 'one-restore-recovery';
const RECOVERY_VERSION = 1;
const MAX_RECOVERY_BYTES = 100_000;
const DONE_COUNT_STORAGE_KEY = 'one.doneCount';
const TIMER_STORAGE_KEY = 'one.timer.v1';
const HISTORY_STORAGE_KEY = 'one.history.v1';
const SESSION_STORAGE_KEY = 'one.activeSession.v1';
const HISTORY_LIMIT = 90;
const MAX_DAILY_COUNT = 1000;
const MAX_HISTORY_BYTES = 50_000;
const MAX_DONE_COUNT_BYTES = 32;
const DONE_COUNT_PATTERN = /^(0|[1-9]\d{0,15})$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainBackupObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(key) {
  if (typeof key !== 'string' || !DATE_KEY_PATTERN.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function normalizeHistory(value) {
  if (!isPlainBackupObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, count]) => (
        isValidDateKey(key)
        && Number.isInteger(count)
        && count >= 0
        && count <= MAX_DAILY_COUNT
      ))
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, HISTORY_LIMIT),
  );
}

function parseDoneCount(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DONE_COUNT_BYTES) return 0;
  if (!DONE_COUNT_PATTERN.test(raw)) return 0;
  const count = Number(raw);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function historyTotal(history) {
  return Object.values(history).reduce((sum, count) => sum + count, 0);
}

function timerMinuteBounds() {
  const guard = globalThis.ONE_TIMER_STATE_GUARD;
  return {
    min: Number.isInteger(guard?.minMinutes) ? guard.minMinutes : 1,
    max: Number.isInteger(guard?.maxMinutes) ? guard.maxMinutes : 180,
  };
}

function validTimerMinutes(minutes) {
  const { min, max } = timerMinuteBounds();
  return Number.isInteger(minutes) && minutes >= min && minutes <= max;
}

function normalizedBackupData(data) {
  return {
    doneCount: data.doneCount,
    history: normalizeHistory(data.history),
    selectedMinutes: data.selectedMinutes,
  };
}

function backupDataGuard(data) {
  return JSON.stringify(normalizedBackupData(data));
}

function isStrictHistory(value) {
  if (!isPlainBackupObject(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > HISTORY_LIMIT) return false;

  return entries.every(([key, count]) => (
    isValidDateKey(key)
    && Number.isInteger(count)
    && count >= 0
    && count <= MAX_DAILY_COUNT
  ));
}

function validateBackupData(value) {
  if (!isPlainBackupObject(value)) return null;
  if (!hasOnlyKeys(value, new Set(['doneCount', 'history', 'selectedMinutes']))) return null;

  const { doneCount, history, selectedMinutes } = value;
  if (!Number.isSafeInteger(doneCount) || doneCount < 0) return null;
  if (!isStrictHistory(history)) return null;
  if (!validTimerMinutes(selectedMinutes)) return null;

  const total = historyTotal(history);
  if (!Number.isSafeInteger(total) || doneCount < total) return null;

  return {
    doneCount,
    history: normalizeHistory(history),
    selectedMinutes,
  };
}

function validateBackupPayload(value) {
  if (!isPlainBackupObject(value)) return null;
  if (!hasOnlyKeys(value, new Set(['format', 'version', 'exportedAt', 'data']))) return null;
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) return null;
  if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) return null;
  return validateBackupData(value.data);
}

function hasActiveTimerContext(state) {
  if (!validTimerMinutes(state?.selectedMinutes)) return true;
  const fullDuration = state.selectedMinutes * 60;
  return state.running === true
    || state.completionReady === true
    || (
      Number.isInteger(state.remainingSeconds)
      && state.remainingSeconds > 0
      && state.remainingSeconds < fullDuration
    );
}

export function useBackupControl() {
  const timerState = useTimerState();
  const progressState = useProgressOverviewState();
  const timerStateRef = useRef(timerState);
  const progressStateRef = useRef(progressState);
  const storageAccessFailedRef = useRef(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [importDisabled, setImportDisabled] = useState(true);
  const [undoHidden, setUndoHidden] = useState(true);
  const [undoDisabled, setUndoDisabled] = useState(true);
  const [backupStatus, setBackupStatus] = useState('');

  timerStateRef.current = timerState;
  progressStateRef.current = progressState;

  function reportStorageFailure() {
    storageAccessFailedRef.current = true;
    setStorageFailed(true);
    window.dispatchEvent(new Event('one:storage-error'));
  }

  function safeRead(key, fallback = '') {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      reportStorageFailure();
      return fallback;
    }
  }

  function tabCoordinationAvailable() {
    return !storageAccessFailedRef.current
      && globalThis.ONE_TAB_COORDINATION?.isEnabled?.() === true;
  }

  function readStoredDoneCount() {
    return parseDoneCount(safeRead(DONE_COUNT_STORAGE_KEY, '0'));
  }

  function readHistory() {
    const raw = safeRead(HISTORY_STORAGE_KEY);
    if (!raw || raw.length > MAX_HISTORY_BYTES) return {};

    try {
      return normalizeHistory(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  function readPreferredMinutes() {
    const raw = safeRead(TIMER_STORAGE_KEY);
    const storedState = globalThis.ONE_TIMER_STATE_GUARD?.parse?.(raw) ?? null;
    const storedMinutes = storedState?.selectedMinutes;
    if (validTimerMinutes(storedMinutes)) return storedMinutes;

    const currentMinutes = timerStateRef.current?.selectedMinutes;
    return validTimerMinutes(currentMinutes) ? currentMinutes : 25;
  }

  function currentBackupData() {
    return {
      doneCount: readStoredDoneCount(),
      history: readHistory(),
      selectedMinutes: readPreferredMinutes(),
    };
  }

  function readInMemoryBackupSnapshot() {
    return validateBackupData({
      doneCount: parseDoneCount(String(progressStateRef.current?.doneCount ?? '0')),
      history: normalizeHistory(progressStateRef.current?.history),
      selectedMinutes: timerStateRef.current?.selectedMinutes,
    });
  }

  function currentRestoreGuard() {
    return backupDataGuard(currentBackupData());
  }

  function readStableBackupSnapshot() {
    if (!tabCoordinationAvailable()) return null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const countBefore = readStoredDoneCount();
      const historyBefore = readHistory();
      const countAfter = readStoredDoneCount();
      const historyAfter = readHistory();

      const historyStable = JSON.stringify(historyBefore) === JSON.stringify(historyAfter);
      const total = historyTotal(historyAfter);
      if (
        countBefore === countAfter
        && historyStable
        && Number.isSafeInteger(total)
        && countAfter >= total
      ) {
        return {
          doneCount: countAfter,
          history: historyAfter,
          selectedMinutes: readPreferredMinutes(),
        };
      }
    }

    return null;
  }

  function createBackupPayload() {
    const coordinationAvailable = tabCoordinationAvailable();
    let data = coordinationAvailable && !storageAccessFailedRef.current
      ? readStableBackupSnapshot()
      : null;

    if (storageAccessFailedRef.current) data = null;
    let usedMemoryFallback = false;
    if (!data && (!coordinationAvailable || storageAccessFailedRef.current)) {
      data = readInMemoryBackupSnapshot();
      usedMemoryFallback = data !== null;
    }
    if (!data) return { payload: null, usedMemoryFallback: false };

    return {
      payload: {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      },
      usedMemoryFallback,
    };
  }

  function parseRecoveryPoint(raw) {
    if (!raw || raw.length > MAX_RECOVERY_BYTES) return null;

    try {
      const value = JSON.parse(raw);
      if (!isPlainBackupObject(value)) return null;
      if (!hasOnlyKeys(value, new Set(['format', 'version', 'createdAt', 'expectedData', 'data']))) return null;
      if (value.format !== RECOVERY_FORMAT || value.version !== RECOVERY_VERSION) return null;
      if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return null;

      const data = validateBackupData(value.data);
      const expectedData = validateBackupData(value.expectedData);
      if (!data || !expectedData) return null;

      return {
        createdAt: value.createdAt,
        expectedData,
        data,
      };
    } catch {
      return null;
    }
  }

  function readRecoveryPoint() {
    return parseRecoveryPoint(safeRead(RECOVERY_STORAGE_KEY));
  }

  function readValidRecoveryRaw() {
    const raw = safeRead(RECOVERY_STORAGE_KEY);
    return parseRecoveryPoint(raw) ? raw : null;
  }

  function saveRecoveryPoint(data, expectedData) {
    if (!tabCoordinationAvailable()) return null;

    const payload = JSON.stringify({
      format: RECOVERY_FORMAT,
      version: RECOVERY_VERSION,
      createdAt: new Date().toISOString(),
      expectedData: normalizedBackupData(expectedData),
      data: normalizedBackupData(data),
    });
    if (payload.length > MAX_RECOVERY_BYTES) return null;

    try {
      localStorage.setItem(RECOVERY_STORAGE_KEY, payload);
      return localStorage.getItem(RECOVERY_STORAGE_KEY) === payload ? payload : null;
    } catch {
      reportStorageFailure();
      return null;
    }
  }

  function restorePreviousRecoveryPoint(expectedCurrentRaw, previousRaw) {
    if (typeof expectedCurrentRaw !== 'string') return false;

    try {
      if (localStorage.getItem(RECOVERY_STORAGE_KEY) !== expectedCurrentRaw) return false;

      if (previousRaw === null) {
        localStorage.removeItem(RECOVERY_STORAGE_KEY);
      } else {
        localStorage.setItem(RECOVERY_STORAGE_KEY, previousRaw);
      }

      return localStorage.getItem(RECOVERY_STORAGE_KEY) === previousRaw;
    } catch {
      reportStorageFailure();
      return false;
    }
  }

  function removeRecoveryPoint() {
    try {
      localStorage.removeItem(RECOVERY_STORAGE_KEY);
      return localStorage.getItem(RECOVERY_STORAGE_KEY) === null;
    } catch {
      reportStorageFailure();
      return false;
    }
  }

  function canRestoreBackup() {
    if (!tabCoordinationAvailable() || hasActiveTimerContext(timerStateRef.current)) return false;

    const activeStoredTimer = globalThis.ONE_TAB_COORDINATION?.hasActiveStoredTimer?.() === true;
    if (!tabCoordinationAvailable()) return false;
    return !activeStoredTimer;
  }

  function refreshBackupControlAvailability({ announce = false } = {}) {
    const storageAvailable = tabCoordinationAvailable() && !storageAccessFailedRef.current;
    let restoreAvailable = false;
    let blockedByActiveTimer = false;

    if (storageAvailable) {
      restoreAvailable = canRestoreBackup();
      blockedByActiveTimer = !restoreAvailable && !storageAccessFailedRef.current;
    }

    if (storageAccessFailedRef.current) {
      restoreAvailable = false;
      blockedByActiveTimer = false;
    }

    setImportDisabled(!restoreAvailable);
    if (!restoreAvailable) {
      setUndoDisabled(true);
      if (announce) {
        setBackupStatus(
          blockedByActiveTimer
            ? '集中タイマーの進行中・一時停止中・未記録完了中は復元できません。JSON書き出しは利用できます。'
            : '安全な復元に必要な端末保存・タブ間調停を利用できないため、JSON書き出しだけ利用できます。',
        );
      }
    }

    return restoreAvailable;
  }

  function refreshRecoveryAvailability() {
    if (!refreshBackupControlAvailability({ announce: true })) return false;

    const recovery = readRecoveryPoint();
    const matchesRestoredState = recovery !== null
      && currentRestoreGuard() === backupDataGuard(recovery.expectedData);

    setUndoHidden(!matchesRestoredState);
    setUndoDisabled(matchesRestoredState && !canRestoreBackup());
    return true;
  }

  function exportBackup() {
    const { payload: backup, usedMemoryFallback } = createBackupPayload();
    if (!backup) {
      setBackupStatus(
        tabCoordinationAvailable() && !storageAccessFailedRef.current
          ? '別タブで記録が更新中のためバックアップを作れませんでした。少ししてからもう一度試してください。'
          : '端末保存を利用できず、現在画面の記録も安全なバックアップ形式へ変換できませんでした。記録内容を確認してください。',
      );
      return false;
    }

    const payload = JSON.stringify(backup, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `one-backup-${dateKey()}.json`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupStatus(
      usedMemoryFallback
        ? '端末保存を利用できないため、このタブに残っている累計・日次履歴・タイマー時間を救出用JSONとして書き出しました。実行中タイマーは含まれていません。'
        : 'バックアップを書き出しました。実行中タイマーは含まれていません。',
    );
    return true;
  }

  function applyBackup(restored) {
    const progressApplied = globalThis.ONE_REACT_PROGRESS_OVERVIEW?.restoreBackupData?.({
      doneCount: restored.doneCount,
      history: restored.history,
    }) === true;
    const timerApplied = timerActions.selectMinutes(restored.selectedMinutes) === true;
    return progressApplied && timerApplied;
  }

  async function importBackup(file) {
    if (!refreshBackupControlAvailability({ announce: true })) return false;
    if (!canRestoreBackup()) {
      setBackupStatus('集中タイマーの進行中・一時停止中・未記録完了中は復元できません。先にその1回を終えてください。');
      return false;
    }

    if (file.size <= 0 || file.size > MAX_BACKUP_BYTES) {
      setBackupStatus('バックアップファイルのサイズが不正です。100KB以下のONEバックアップを選んでください。');
      return false;
    }

    let parsed;
    try {
      const raw = await file.text();
      if (raw.length > MAX_BACKUP_BYTES) throw new Error('too large');
      parsed = JSON.parse(raw);
    } catch {
      setBackupStatus('バックアップを読み取れませんでした。JSONファイルを確認してください。');
      return false;
    }

    const restored = validateBackupPayload(parsed);
    if (!restored) {
      setBackupStatus('ONEのバックアップ形式として検証できませんでした。データは変更していません。');
      return false;
    }

    if (!canRestoreBackup()) {
      setBackupStatus('読み込み中にタイマー状態が変わったため復元を中止しました。データは変更していません。');
      return false;
    }

    const restoreGuard = currentRestoreGuard();
    const historyDays = Object.keys(restored.history).length;
    const confirmed = window.confirm(
      `現在の累計と日次履歴を置き換えます。\n\n累計: ${restored.doneCount}回\n日次履歴: ${historyDays}日分\nタイマー: ${restored.selectedMinutes}分\n\n復元対象は累計・日次履歴・タイマー時間だけです。復元しますか？`,
    );
    if (!confirmed) {
      setBackupStatus('復元をキャンセルしました。データは変更していません。');
      return false;
    }

    if (!canRestoreBackup()) {
      setBackupStatus('確認中にタイマー状態が変わったため復元を中止しました。データは変更していません。');
      return false;
    }
    if (restoreGuard !== currentRestoreGuard()) {
      setBackupStatus('確認中に別タブで記録やタイマー設定が更新されたため復元を中止しました。最新状態を確認してからやり直してください。');
      return false;
    }

    const recoveryData = readStableBackupSnapshot();
    if (!recoveryData || backupDataGuard(recoveryData) !== restoreGuard) {
      setBackupStatus('復元前の状態を安全に退避できなかったため復元を中止しました。データは変更していません。');
      return false;
    }

    const previousRecoveryRaw = readValidRecoveryRaw();
    const expectedGuard = backupDataGuard(restored);
    const savedRecoveryRaw = saveRecoveryPoint(recoveryData, restored);
    if (!savedRecoveryRaw) {
      setBackupStatus('復元前の状態を端末内に退避できなかったため復元を中止しました。データは変更していません。');
      return false;
    }

    if (restoreGuard !== currentRestoreGuard() || !canRestoreBackup()) {
      restorePreviousRecoveryPoint(savedRecoveryRaw, previousRecoveryRaw);
      setBackupStatus('復元直前に別タブまたはタイマー状態が変わったため復元を中止しました。データは変更していません。');
      return false;
    }

    const applied = applyBackup(restored);
    const savedMatches = currentRestoreGuard() === expectedGuard;
    if (!applied || !savedMatches) {
      const rolledBack = applyBackup(recoveryData)
        && currentRestoreGuard() === backupDataGuard(recoveryData);
      restorePreviousRecoveryPoint(savedRecoveryRaw, previousRecoveryRaw);
      setBackupStatus(
        rolledBack
          ? '復元データを端末保存で確認できなかったため、元の状態へ戻しました。'
          : '復元データを端末保存で確認できず、元の状態への戻しも確認できませんでした。JSONを書き出して現在状態を退避してください。',
      );
      refreshRecoveryAvailability();
      return false;
    }

    globalThis.ONE_REACT_SECONDARY_STATE?.refreshProgress?.({ force: true });
    setBackupStatus('バックアップを復元しました。問題があれば「復元前に戻す」で1世代だけ元に戻せます。');
    refreshRecoveryAvailability();
    return true;
  }

  function undoRestore() {
    if (!refreshBackupControlAvailability({ announce: true })) return false;
    if (!canRestoreBackup()) {
      setBackupStatus('タイマー状態が変わったため、復元前には戻せません。');
      return false;
    }

    const recovery = readRecoveryPoint();
    if (!recovery) {
      setBackupStatus('戻せる復元前データがありません。');
      setUndoHidden(true);
      return false;
    }

    if (currentRestoreGuard() !== backupDataGuard(recovery.expectedData)) {
      setBackupStatus('復元後に記録やタイマー設定が変わっているため、上書きを避けて復元前には戻しません。');
      setUndoHidden(true);
      return false;
    }

    const applied = applyBackup(recovery.data);
    const savedMatches = currentRestoreGuard() === backupDataGuard(recovery.data);
    if (!applied || !savedMatches) {
      setBackupStatus('復元前の状態へ戻せませんでした。現在の記録はJSONで退避してください。');
      return false;
    }

    removeRecoveryPoint();
    globalThis.ONE_REACT_SECONDARY_STATE?.refreshProgress?.({ force: true });
    setBackupStatus('復元前の状態へ戻しました。');
    refreshRecoveryAvailability();
    return true;
  }

  useEffect(() => {
    function handleStorageFailure() {
      storageAccessFailedRef.current = true;
      setStorageFailed(true);
      setImportDisabled(true);
      setUndoDisabled(true);
    }

    function handleAvailabilityChange() {
      refreshRecoveryAvailability();
    }

    window.addEventListener('one:storage-error', handleStorageFailure);
    window.addEventListener('one:timer-state', handleAvailabilityChange);
    window.addEventListener('one:progress-overview-state', handleAvailabilityChange);
    window.addEventListener('storage', handleAvailabilityChange);
    window.addEventListener('pageshow', handleAvailabilityChange);
    document.addEventListener('visibilitychange', handleAvailabilityChange);
    refreshRecoveryAvailability();

    return () => {
      window.removeEventListener('one:storage-error', handleStorageFailure);
      window.removeEventListener('one:timer-state', handleAvailabilityChange);
      window.removeEventListener('one:progress-overview-state', handleAvailabilityChange);
      window.removeEventListener('storage', handleAvailabilityChange);
      window.removeEventListener('pageshow', handleAvailabilityChange);
      document.removeEventListener('visibilitychange', handleAvailabilityChange);
    };
  }, [timerState.running, timerState.remainingSeconds, timerState.completionReady]);

  return {
    storageFailed,
    importDisabled,
    undoHidden,
    undoDisabled,
    backupStatus,
    exportBackup,
    importBackup,
    undoRestore,
  };
}
