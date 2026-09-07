const dataResetButton = document.querySelector('#data-reset-button');
const dataResetConfirm = document.querySelector('#data-reset-confirm');
const dataResetConfirmButton = document.querySelector('#data-reset-confirm-button');
const dataResetCancelButton = document.querySelector('#data-reset-cancel-button');
const dataResetStatus = document.querySelector('#data-reset-status');

const RESET_SIGNAL_KEY = 'one.resetSignal.v1';
const PRIVACY_RESET_KEYS = new Set([
  'one.task',
  'one.taskDate.v1',
  'one.doneCount',
  'one.timer.v1',
  'one.history.v1',
  'one.focusMode.v1',
  'one.activeSession.v1',
  'one.tabStorageProbe.v1',
  'one.restoreRecovery.v1',
  'one.completionSound.v1',
  'one.wakeLock.v1',
  'one.theme.v1',
  RESET_SIGNAL_KEY,
]);

function setDataResetStatus(message) {
  dataResetStatus.textContent = message;
}

function setDataResetConfirmationVisible(visible) {
  const active = visible === true;
  dataResetButton.hidden = active;
  dataResetConfirm.hidden = !active;
}

function reportDataResetStorageFailure() {
  reportStorageFailure();
  return false;
}

function clearStoredOneData() {
  try {
    PRIVACY_RESET_KEYS.forEach((key) => localStorage.removeItem(key));
    return [...PRIVACY_RESET_KEYS].every((key) => localStorage.getItem(key) === null);
  } catch {
    return reportDataResetStorageFailure();
  }
}

function broadcastDataReset() {
  try {
    localStorage.setItem(RESET_SIGNAL_KEY, `${Date.now()}-${Math.random()}`);
    localStorage.removeItem(RESET_SIGNAL_KEY);
    return true;
  } catch {
    return reportDataResetStorageFailure();
  }
}

function stopLocalTimerForReset() {
  clearTimerInterval();
  endAt = null;
}

function reloadAfterReset() {
  stopLocalTimerForReset();
  window.location.reload();
}

dataResetButton.addEventListener('click', () => {
  setDataResetConfirmationVisible(true);
  setDataResetStatus('削除すると元に戻せません。必要なら先にJSONバックアップを書き出してください。');
  dataResetConfirmButton.focus();
});

dataResetCancelButton.addEventListener('click', () => {
  setDataResetConfirmationVisible(false);
  setDataResetStatus('データ削除をキャンセルしました。');
  dataResetButton.focus();
});

dataResetConfirmButton.addEventListener('click', () => {
  dataResetConfirmButton.disabled = true;
  dataResetCancelButton.disabled = true;

  const cleared = clearStoredOneData();
  if (!cleared) {
    dataResetConfirmButton.disabled = false;
    dataResetCancelButton.disabled = false;
    setDataResetStatus(
      'ブラウザの保存領域からONEデータを削除できませんでした。ブラウザのサイトデータ設定から削除してください。',
    );
    return;
  }

  const broadcasted = broadcastDataReset();
  setDataResetStatus(
    broadcasted
      ? 'この端末のONEデータを削除しました。初期状態へ戻します。'
      : 'このタブのONEデータを削除しました。別タブが開いている場合は閉じてください。',
  );
  reloadAfterReset();
});

window.addEventListener('storage', (event) => {
  if (event.key !== RESET_SIGNAL_KEY || event.newValue === null) return;

  const cleared = clearStoredOneData();
  if (!cleared) {
    setDataResetStatus('別タブからのデータ削除を反映できませんでした。このタブを閉じてください。');
    return;
  }

  reloadAfterReset();
});
