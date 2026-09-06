const backupExportButton = document.querySelector('#backup-export-button');
const backupImportButton = document.querySelector('#backup-import-button');
const backupFileInput = document.querySelector('#backup-file-input');
const backupStatus = document.querySelector('#backup-status');

const BACKUP_FORMAT = 'one-focus-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 100_000;

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

function validateBackupPayload(value) {
  if (!isPlainBackupObject(value)) return null;
  if (!hasOnlyKeys(value, new Set(['format', 'version', 'exportedAt', 'data']))) return null;
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) return null;
  if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) return null;
  if (!isPlainBackupObject(value.data)) return null;
  if (!hasOnlyKeys(value.data, new Set(['doneCount', 'history', 'selectedMinutes']))) return null;

  const { doneCount, history, selectedMinutes: restoredMinutes } = value.data;
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

function canRestoreBackup() {
  if (!tabCoordinationEnabled || hasActiveDailyTaskContext()) return false;

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  return !(storedSessionId && isTimerStateActive(storedState));
}

function currentRestoreGuard() {
  return `${safeRead(STORAGE_KEYS.count, '0')}\n${safeRead(STORAGE_KEYS.history, '{}')}`;
}

function setBackupStatus(message) {
  backupStatus.textContent = message;
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

  const restoreGuard = currentRestoreGuard();
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
  if (restoreGuard !== currentRestoreGuard()) {
    setBackupStatus('確認中に別タブで記録が更新されたため復元を中止しました。最新状態を確認してからやり直してください。');
    return;
  }

  applyBackup(restored);
  setBackupStatus('バックアップを復元しました。累計・日次履歴・タイマー時間を反映しました。');
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

backupFileInput.addEventListener('change', async () => {
  const [file] = backupFileInput.files ?? [];
  backupFileInput.value = '';
  if (file) await importBackup(file);
});
