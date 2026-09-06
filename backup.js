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

function createBackupPayload() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      doneCount: readStoredDoneCount(),
      history: readHistory(),
      selectedMinutes: readPreferredMinutes(),
    },
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

  return {
    doneCount,
    history: normalizeHistory(history),
    selectedMinutes: restoredMinutes,
  };
}

function canRestoreBackup() {
  if (hasActiveDailyTaskContext()) return false;
  if (!tabCoordinationEnabled) return true;

  const storedState = readTimerState();
  const storedSessionId = readStoredSessionId();
  return !(storedSessionId && isTimerStateActive(storedState));
}

function setBackupStatus(message) {
  backupStatus.textContent = message;
}

function exportBackup() {
  const payload = JSON.stringify(createBackupPayload(), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `one-backup-${dateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
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

  applyBackup(restored);
  setBackupStatus('バックアップを復元しました。累計・日次履歴・タイマー時間を反映しました。');
  backupExportButton.focus();
}

backupExportButton.addEventListener('click', exportBackup);
backupImportButton.addEventListener('click', () => {
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
