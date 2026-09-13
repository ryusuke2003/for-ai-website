import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

const FOCUS_MODE_STORAGE_KEY = 'one.focusMode.v1';

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function readStoredFocusMode() {
  try {
    return localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === '1';
  } catch {
    reportStorageFailure();
    return false;
  }
}

function persistFocusModePreference(active) {
  const value = active ? '1' : '0';

  try {
    localStorage.setItem(FOCUS_MODE_STORAGE_KEY, value);
    if (localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === value) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

export function useFocusModeControl(completionReady) {
  const [active, setActive] = useState(readStoredFocusMode);
  const [status, setStatus] = useState('');

  const setFocusMode = useCallback((enabled, { persist = true, announce = true } = {}) => {
    const nextActive = enabled === true;
    setActive(nextActive);

    const persisted = !persist || persistFocusModePreference(nextActive);
    if (!announce) return persisted;

    if (!persisted) {
      setStatus(nextActive
        ? '集中表示に切り替えましたが、このブラウザには設定を保存できませんでした。再読み込みすると通常表示に戻る可能性があります。'
        : '通常表示に戻りましたが、このブラウザには設定を保存できませんでした。再読み込みすると集中表示へ戻る可能性があります。');
      return false;
    }

    setStatus(nextActive
      ? '集中表示に切り替えました。Escapeキーでも通常表示に戻れます。'
      : '通常表示に戻りました。');
    return true;
  }, []);

  const toggle = useCallback(() => {
    setFocusMode(!active);
  }, [active, setFocusMode]);

  useLayoutEffect(() => {
    document.body.classList.toggle('focus-mode', active);
    return () => {
      document.body.classList.remove('focus-mode');
    };
  }, [active]);

  useEffect(() => {
    if (completionReady && active) {
      setFocusMode(false, { announce: false });
    }
  }, [active, completionReady, setFocusMode]);

  return {
    active,
    status,
    toggle,
  };
}
