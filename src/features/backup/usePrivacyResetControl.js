import { useCallback, useEffect, useMemo, useState } from 'react';

const RESET_SIGNAL_KEY = 'one.resetSignal.v1';
const RESET_SIGNAL_VALUE_PATTERN = /^(?:[a-z0-9]+-[0-9a-f]{16}|[a-z0-9]+-fallback-[a-z0-9]+)$/;
const MAX_RESET_SIGNAL_VALUE_LENGTH = 80;
const PRIVACY_RESET_KEYS = new Set([
  'one.task',
  'one.taskDate.v1',
  'one.doneCount',
  'one.timer.v1',
  'one.history.v1',
  'one.dailyGoal.v1',
  'one.focusMode.v1',
  'one.activeSession.v1',
  'one.tabStorageProbe.v1',
  'one.restoreRecovery.v1',
  'one.completionSound.v1',
  'one.completionNotification.v1',
  'one.completionEffectClaim.v1',
  'one.wakeLock.v1',
  'one.theme.v1',
  'one.trayLastFocusMinutes.v1',
  RESET_SIGNAL_KEY,
]);

let resetSignalFallbackCounter = 0;

function reportDataResetStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
  return false;
}

function clearStoredOneData({ preserveResetSignal = false } = {}) {
  const keys = [...PRIVACY_RESET_KEYS].filter((key) => (
    !preserveResetSignal || key !== RESET_SIGNAL_KEY
  ));

  try {
    keys.forEach((key) => localStorage.removeItem(key));
    return keys.every((key) => localStorage.getItem(key) === null);
  } catch {
    return reportDataResetStorageFailure();
  }
}

function isValidResetSignalValue(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_RESET_SIGNAL_VALUE_LENGTH
    && RESET_SIGNAL_VALUE_PATTERN.test(value);
}

function createResetSignalValue() {
  const timestamp = Date.now().toString(36);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(8);
      globalThis.crypto.getRandomValues(bytes);
      const randomPart = [...bytes]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      return `${timestamp}-${randomPart}`;
    } catch {
      // The reset signal is not a secret. Fall back to local uniqueness below.
    }
  }

  resetSignalFallbackCounter = (resetSignalFallbackCounter + 1) % 1_000_000;
  return `${timestamp}-fallback-${resetSignalFallbackCounter.toString(36)}`;
}

function broadcastDataReset() {
  const signal = createResetSignalValue();
  try {
    localStorage.setItem(RESET_SIGNAL_KEY, signal);
    if (localStorage.getItem(RESET_SIGNAL_KEY) !== signal) return false;

    localStorage.removeItem(RESET_SIGNAL_KEY);
    return localStorage.getItem(RESET_SIGNAL_KEY) === null;
  } catch {
    return reportDataResetStorageFailure();
  }
}

function reloadAfterReset() {
  window.dispatchEvent(new Event('one:privacy-reset-prepare'));
  window.location.reload();
}

export function usePrivacyResetControl() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== RESET_SIGNAL_KEY || !isValidResetSignalValue(event.newValue)) return;

      const cleared = clearStoredOneData({ preserveResetSignal: true });
      if (!cleared) {
        setStatus('別タブからのデータ削除を反映できませんでした。このタブを閉じてください。');
        return;
      }

      reloadAfterReset();
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const openReset = useCallback(() => {
    setConfirmVisible(true);
    setStatus('削除すると元に戻せません。必要なら先にJSONバックアップを書き出してください。');
  }, []);

  const cancelReset = useCallback(() => {
    setConfirmVisible(false);
    setStatus('データ削除をキャンセルしました。');
  }, []);

  const confirmReset = useCallback(() => {
    setBusy(true);
    const cleared = clearStoredOneData();
    if (!cleared) {
      setBusy(false);
      setStatus('ブラウザの保存領域からONEデータを削除できませんでした。ブラウザのサイトデータ設定から削除してください。');
      return false;
    }

    const broadcasted = broadcastDataReset();
    setStatus(
      broadcasted
        ? 'この端末のONEデータを削除しました。初期状態へ戻します。'
        : 'このタブのONEデータを削除しました。別タブが開いている場合は閉じてください。',
    );
    reloadAfterReset();
    return true;
  }, []);

  return useMemo(() => ({
    resetButtonHidden: confirmVisible,
    resetConfirmHidden: !confirmVisible,
    resetConfirmDisabled: busy,
    resetCancelDisabled: busy,
    resetStatus: status,
    openReset,
    cancelReset,
    confirmReset,
  }), [busy, cancelReset, confirmReset, confirmVisible, openReset, status]);
}
