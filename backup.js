const backupExportButton = document.querySelector('#backup-export-button');
const backupImportButton = document.querySelector('#backup-import-button');
const backupUndoButton = document.querySelector('#backup-undo-button');
const backupFileInput = document.querySelector('#backup-file-input');
const backupStatus = document.querySelector('#backup-status');

const BACKUP_FORMAT = 'one-focus-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 100_000;
const RECOVERY_STORAGE_KEY = 'one.restoreRecovery.v1';
const RECOVERY_FORMAT = 'one-restore-recovery';
const RECOVERY_VERSION = 1;
const MAX_RECOVERY_BYTES = 60_000;
const DATA_SIGNATURE_PATTERN = /^\d{1,6}:[0-9a-f]{8}$/;

function isPlainBackupObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function availablePresetMinutes() {
  return presetButtons
    .map((button) => Number.parseInt(button.dataset.minutes, 10))
    .filter((minutes) => Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_MINUTES);
}

function readPreferredMinutes() {
  const storedMinutes = Number.parseInt(readTimerState()?.selectedMinutes, 10);
  const availableMinutes = availablePresetMinutes();
  return availableMinutes.includes(storedMinutes) ? storedMinutes : selectedMinutes;
}

function readStoredDoneCount() {
  const count = Number.parseInt(safeRead(STORAGE_KEYS.count, '0'), 10);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function historyTotal(history) {
  return Object.values(history).reduce((sum, count) => sum + count, 0);
}

function normalizedBackupData(data) {
  return {
    doneCount: data.doneCount,
    history: normalizeHistory(data.history),
    selectedMinutes: data.selectedMinutes,
  };
}

function dataSignature(data) {
  const serialized = JSON.stringify(normalizedBackupData(data));
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${serialized.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function currentRestoreSignature() {
  return dataSignature({
    doneCount: readStoredDoneCount(),
    history: readHistory(),
    selectedMinutes: readPreferredMinutes(),
  });
}

function readStableBackupSnapshot() {
  if (!tabCoordinationEnabled) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const countBefore = readStoredDoneCount();
    const historyBefore = readHistory();
    const countAfter = readStoredDoneCount();
    const historyAfter = readHistory();

    const historyStable = JSON.stringify(historyBefore) === JSON.stringify(historyAfter);
    const total = historyTotal(historyAfter);
    if (countBefore === countAfter && historyStable && Number.isSafeInteger(total) && countAfter >= total) {
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
  const data = readStableBackupSnapshot();
  if (!data) return null;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
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

  const { doneCount, history, selectedMinutes: restoredMinutes } = value;
  if (!Number.isSafeInteger(doneCount) || doneCount < 0) return null;
  if (!isStrictHistory(history)) return null;
  if (!availablePresetMinutes().includes(restoredMinutes)) return null;

  const total = historyTotal(history);
  if (!Number.isSafeInteger(total) || doneCount < total) return null;

  return {
    doneCount,
    history: normalizeHistory(history),
    selectedMinutes: restoredMinutes,
  };
}

function validateBackupPayload(value) {
  if (!isPlainBackupObject(value)) return null;
  if (!hasOnlyKeys(value, new Set(['format', 'version', 'exportedAt', 'data']))) return null;
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) return null;
  if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) return null;
  return validateBackupData(value.data);
}

function canRestoreBackup() {
  if (!tabCoordinationEnabled || hasActiveDailyTaskContext()) return false;

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  return !(storedSessionId && isTimerStateActive(storedState));
}

function setBackupStatus(message) {
  backupStatus.textContent = message;
}

function readRecoveryPoint() {
  const raw = safeRead(RECOVERY_STORAGE_KEY);
  if (!raw || raw.length > MAX_RECOVERY_BYTES) return null;

  try {
    const value = JSON.parse(raw);
    if (!isPlainBackupObject(value)) return null;
    if (!hasOnlyKeys(value, new Set(['format', 'version', 'createdAt', 'expectedSignature', 'data']))) return null;
    if (value.format !== RECOVERY_FORMAT || value.version !== RECOVERY_VERSION) return null;
    if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return null;
    if (typeof value.expectedSignature !== 'string' || !DATA_SIGNATURE_PATTERN.test(value.expectedSignature)) return null;

    const data = validateBackupData(value.data);
    if (!data) return null;

    return {
      createdAt: value.createdAt,
      expectedSignature: value.expectedSignature,
      data,
    };
  } catch {
    return null;
  }
}

function saveRecoveryPoint(data, expectedSignature) {
  if (!tabCoordinationEnabled || !DATA_SIGNATURE_PATTERN.test(expectedSignature)) return false;

  const payload = JSON.stringify({
    format: RECOVERY_FORMAT,
    version: RECOVERY_VERSION,
    createdAt: new Date().toISOString(),
    expectedSignature,
    data: normalizedBackupData(data),
  });
  if (payload.length > MAX_RECOVERY_BYTES) return false;

  try {
    localStorage.setItem(RECOVERY_STORAGE_KEY, payload);
    return localStorage.getItem(RECOVERY_STORAGE_KEY) === payload;
  } catch {
    return false;
  }
}

function removeRecoveryPoint() {
  try {
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // Storage failures are reported by the operation that requested the removal.
  }
}

function refreshRecoveryAvailability() {
  const recovery = readRecoveryPoint();
  const matchesRestoredState = recovery !== null
    && currentRestoreSignature() === recovery.expectedSignature;

  backupUndoButton.hidden = !matchesRestoredState;
  backupUndoButton.disabled = matchesRestoredState && !canRestoreBackup();
}

function exportBackup() {
  const backup = createBackupPayload();
  if (!backup) {
    setBackupStatus(
      tabCoordinationEnabled
        ? '別タブで記録が更新中のためバックアップを作れませんでした。少ししてからもう一度試してください。'
        : 'ブラウザの保存領域を利用できないためバックアップを書き出せません。',
    );
    return;
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
  setBackupStatus('バックアップを書き出しました。タスク本文や実行中タイマーは含まれていません。');
}

function applyBackup(restored) {
  safeWrite(STORAGE_KEYS.count, String(restored.doneCount));
  focusHistory = restored.history;
  saveHistory();

  selectedMinutes = restored.selectedMinutes;
  presetButtons.forEach((button) => {
    const active = Number.parseInt(button.dataset.minutes, 10) === selectedMinutes;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  localSessionId = null;
  clearStoredSessionId();
  resetTimer();
  doneCount.textContent = String(restored.doneCount);
  focusHistory = readHistory();
  renderHistory();
  setTimerFeedback(`${selectedMinutes}分のタイマーで再開できます。`);
}

async function importBackup(file) {
  if (!tabCoordinationEnabled) {
    setBackupStatus('ブラウザの保存領域を利用できないためバックアップを復元できません。');
    return;
  }
  if (!canRestoreBackup()) {
    setBackupStatus('集中タイマーの進行中・一時停止中・未記録完了中は復元できません。先にその1回を終えてください。');
    return;
  }

  if (file.size <= 0 || file.size > MAX_BACKUP_BYTES) {
    setBackupStatus('バックアップファイルのサイズが不正です。100KB以下のONEバックアップを選んでください。');
    return;
  }

  let parsed;
  try {
    const raw = await file.text();
    if (raw.length > MAX_BACKUP_BYTES) throw new Error('too large');
    parsed = JSON.parse(raw);
  } catch {
    setBackupStatus('バックアップを読み取れませんでした。JSONファイルを確認してください。');
    return;
  }

  const restored = validateBackupPayload(parsed);
  if (!restored) {
    setBackupStatus('ONEのバックアップ形式として検証できませんでした。データは変更していません。');
    return;
  }

  if (!canRestoreBackup()) {
    setBackupStatus('読み込み中にタイマー状態が変わったため復元を中止しました。データは変更していません。');
    return;
  }

  const restoreSignature = currentRestoreSignature();
  const historyDays = Object.keys(restored.history).length;
  const confirmed = window.confirm(
    `現在の累計と日次履歴を置き換えます。\n\n累計: ${restored.doneCount}回\n日次履歴: ${historyDays}日分\nタイマー: ${restored.selectedMinutes}分\n\nタスク本文は変更しません。復元しますか？`,
  );
  if (!confirmed) {
    setBackupStatus('復元をキャンセルしました。データは変更していません。');
    return;
  }

  if (!canRestoreBackup()) {
    setBackupStatus('確認中にタイマー状態が変わったため復元を中止しました。データは変更していません。');
    return;
  }
  if (restoreSignature !== currentRestoreSignature()) {
    setBackupStatus('確認中に別タブで記録やタイマー設定が更新されたため復元を中止しました。最新状態を確認してからやり直してください。');
    return;
  }

  const recoveryData = readStableBackupSnapshot();
  if (!recoveryData || dataSignature(recoveryData) !== restoreSignature) {
    setBackupStatus('復元前の状態を安全に退避できなかったため復元を中止しました。データは変更していません。');
    return;
  }

  const expectedSignature = dataSignature(restored);
  if (!saveRecoveryPoint(recoveryData, expectedSignature)) {
    setBackupStatus('復元前の状態を端末内に退避できなかったため復元を中止しました。データは変更していません。');
    return;
  }

  applyBackup(restored);
  if (currentRestoreSignature() !== expectedSignature) {
    applyBackup(recoveryData);
    removeRecoveryPoint();
    refreshRecoveryAvailability();
    setBackupStatus('復元後の保存確認に失敗したため、可能な範囲で復元前の状態へ戻しました。');
    return;
  }

  refreshRecoveryAvailability();
  setBackupStatus('バックアップを復元しました。必要なら「直前の復元を取り消す」で復元前の記録へ戻せます。');
  backupUndoButton.focus();
}

function undoLastRestore() {
  if (!tabCoordinationEnabled) {
    setBackupStatus('ブラウザの保存領域を利用できないため復元を取り消せません。');
    return;
  }
  if (!canRestoreBackup()) {
    setBackupStatus('集中タイマーの進行中・一時停止中・未記録完了中は復元を取り消せません。');
    return;
  }

  const recovery = readRecoveryPoint();
  if (!recovery || currentRestoreSignature() !== recovery.expectedSignature) {
    refreshRecoveryAvailability();
    setBackupStatus('復元後に記録またはタイマー設定が変わったため、直前の復元はもう取り消せません。');
    return;
  }

  const currentData = readStableBackupSnapshot();
  if (!currentData || dataSignature(currentData) !== recovery.expectedSignature) {
    setBackupStatus('現在の記録を安全に確認できなかったため、取り消しを中止しました。');
    return;
  }

  const historyDays = Object.keys(recovery.data.history).length;
  const confirmed = window.confirm(
    `復元前の状態へ戻します。\n\n累計: ${recovery.data.doneCount}回\n日次履歴: ${historyDays}日分\nタイマー: ${recovery.data.selectedMinutes}分\n\nこの取り消しは1回だけです。戻しますか？`,
  );
  if (!confirmed) {
    setBackupStatus('取り消しをキャンセルしました。データは変更していません。');
    return;
  }

  if (!canRestoreBackup() || currentRestoreSignature() !== recovery.expectedSignature) {
    refreshRecoveryAvailability();
    setBackupStatus('確認中に状態が変わったため、取り消しを中止しました。');
    return;
  }

  const recoverySignature = dataSignature(recovery.data);
  applyBackup(recovery.data);
  if (currentRestoreSignature() !== recoverySignature) {
    applyBackup(currentData);
    setBackupStatus('取り消し後の保存確認に失敗したため、可能な範囲で取り消し前の状態へ戻しました。');
    return;
  }

  removeRecoveryPoint();
  refreshRecoveryAvailability();
  setBackupStatus('直前の復元を取り消し、復元前の記録へ戻しました。');
  backupExportButton.focus();
}

backupExportButton.addEventListener('click', exportBackup);
backupImportButton.addEventListener('click', () => {
  if (!tabCoordinationEnabled) {
    setBackupStatus('ブラウザの保存領域を利用できないためバックアップを復元できません。');
    return;
  }
  if (!canRestoreBackup()) {
    setBackupStatus('集中タイマーの進行中・一時停止中・未記録完了中は復元できません。');
    return;
  }
  backupFileInput.click();
});
backupUndoButton.addEventListener('click', undoLastRestore);

backupFileInput.addEventListener('change', async () => {
  const [file] = backupFileInput.files ?? [];
  backupFileInput.value = '';
  if (file) await importBackup(file);
});

window.addEventListener('storage', (event) => {
  if ([
    STORAGE_KEYS.count,
    STORAGE_KEYS.history,
    STORAGE_KEYS.timer,
    RECOVERY_STORAGE_KEY,
  ].includes(event.key)) {
    refreshRecoveryAvailability();
  }
});

startButton.addEventListener('click', refreshRecoveryAvailability);
resetButton.addEventListener('click', refreshRecoveryAvailability);
doneButton.addEventListener('click', refreshRecoveryAvailability);
discardButton.addEventListener('click', refreshRecoveryAvailability);
presetButtons.forEach((button) => button.addEventListener('click', refreshRecoveryAvailability));

refreshRecoveryAvailability();
