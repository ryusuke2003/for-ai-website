import { useCallback, useEffect, useRef, useState } from 'react';

const WAKE_LOCK_STORAGE_KEY = 'one.wakeLock.v1';
const WAKE_LOCK_SUPPORTED = (
  'wakeLock' in navigator
  && typeof navigator.wakeLock?.request === 'function'
);

function parseWakeLockPreference(value) {
  if (value === '1') return true;
  if (value === '0' || value === null) return false;
  return null;
}

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function readWakeLockPreference() {
  try {
    return {
      ok: true,
      enabled: parseWakeLockPreference(localStorage.getItem(WAKE_LOCK_STORAGE_KEY)),
    };
  } catch {
    reportStorageFailure();
    return { ok: false, enabled: null };
  }
}

function writeWakeLockPreference(enabled) {
  const value = enabled ? '1' : '0';
  try {
    localStorage.setItem(WAKE_LOCK_STORAGE_KEY, value);
    if (localStorage.getItem(WAKE_LOCK_STORAGE_KEY) === value) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

function defaultStatus({ enabled, active }) {
  if (!WAKE_LOCK_SUPPORTED) return 'このブラウザでは集中中の画面維持を利用できません。';
  if (!enabled) return '画面維持はオフです。オンにすると集中時だけ画面のスリープを抑えます。';
  if (active) return '集中中の画面維持を有効にしています。';
  return '画面維持はオンです。タイマー開始中だけ有効になります。';
}

export function useWakeLockControl(timerRunning) {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [statusOverride, setStatusOverride] = useState(null);
  const sentinelRef = useRef(null);
  const requestPendingRef = useRef(false);
  const enabledRef = useRef(false);
  const runningRef = useRef(timerRunning);
  const mountedRef = useRef(true);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (mountedRef.current) setActive(false);
    if (!sentinel || sentinel.released) return;

    try {
      await sentinel.release();
    } catch {
      // The browser or OS may already have released the lock.
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (
      !WAKE_LOCK_SUPPORTED
      || !enabledRef.current
      || !runningRef.current
      || document.visibilityState !== 'visible'
    ) {
      return false;
    }
    if (sentinelRef.current) return true;
    if (requestPendingRef.current) return false;

    requestPendingRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (
        !enabledRef.current
        || !runningRef.current
        || document.visibilityState !== 'visible'
      ) {
        try {
          await sentinel.release();
        } catch {
          // The browser may already have released the newly-created lock.
        }
        return false;
      }

      sentinelRef.current = sentinel;
      if (mountedRef.current) setActive(true);
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        if (!mountedRef.current) return;
        setActive(false);
        if (enabledRef.current && runningRef.current) {
          setStatusOverride('画面維持が解除されました。次に画面へ戻ったときに再試行します。');
        }
      }, { once: true });
      return true;
    } catch {
      if (mountedRef.current) {
        setStatusOverride('画面維持を有効にできませんでした。タイマー機能はそのまま利用できます。');
      }
      return false;
    } finally {
      requestPendingRef.current = false;
    }
  }, []);

  const syncWakeLockWithTimer = useCallback(async () => {
    if (
      !enabledRef.current
      || !runningRef.current
      || document.visibilityState !== 'visible'
    ) {
      await releaseWakeLock();
      return false;
    }
    return requestWakeLock();
  }, [releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    mountedRef.current = true;

    function applyStoredPreference() {
      const stored = readWakeLockPreference();
      if (!stored.ok || stored.enabled === null) return false;
      enabledRef.current = stored.enabled;
      setEnabled(stored.enabled);
      return true;
    }

    async function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        applyStoredPreference();
        setStatusOverride(null);
      }
      await syncWakeLockWithTimer();
    }

    async function handleStorage(event) {
      if (event.key !== WAKE_LOCK_STORAGE_KEY) return;
      const nextEnabled = parseWakeLockPreference(event.newValue);
      if (nextEnabled === null) return;

      enabledRef.current = nextEnabled;
      setEnabled(nextEnabled);
      const lockActive = await syncWakeLockWithTimer();
      if (!mountedRef.current) return;
      setStatusOverride(
        nextEnabled
          ? lockActive && runningRef.current
            ? '別のタブで画面維持がオンになりました。集中中の画面維持を有効にしています。'
            : '別のタブで画面維持がオンになりました。このタブにも反映しました。'
          : '別のタブで画面維持がオフになりました。このタブにも反映しました。',
      );
    }

    function handlePageHide() {
      void releaseWakeLock();
    }

    applyStoredPreference();
    void syncWakeLockWithTimer();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('storage', handleStorage);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('storage', handleStorage);
      void releaseWakeLock();
    };
  }, [releaseWakeLock, syncWakeLockWithTimer]);

  useEffect(() => {
    runningRef.current = timerRunning;
    setStatusOverride(null);
    void syncWakeLockWithTimer();
  }, [timerRunning, syncWakeLockWithTimer]);

  async function toggle() {
    if (!WAKE_LOCK_SUPPORTED) return;

    const nextEnabled = !enabledRef.current;
    enabledRef.current = nextEnabled;
    setEnabled(nextEnabled);
    const persisted = writeWakeLockPreference(nextEnabled);

    if (!nextEnabled) {
      await releaseWakeLock();
      if (!mountedRef.current) return;
      setStatusOverride(
        persisted
          ? '画面維持をオフにしました。'
          : '画面維持をオフにしましたが、このブラウザには設定を保存できませんでした。',
      );
      return;
    }

    const lockActive = await syncWakeLockWithTimer();
    if (!mountedRef.current) return;
    setStatusOverride(
      persisted
        ? runningRef.current
          ? lockActive
            ? '画面維持をオンにしました。集中中は画面のスリープを抑えます。'
            : '画面維持をオンにしましたが、現在は画面維持を取得できませんでした。タイマー機能はそのまま利用できます。'
          : '画面維持をオンにしました。タイマー開始中だけ有効になります。'
        : '画面維持をオンにしましたが、このブラウザには設定を保存できませんでした。今のタブでは利用できます。',
    );
  }

  return {
    label: WAKE_LOCK_SUPPORTED ? `画面維持 ${enabled ? 'ON' : 'OFF'}` : '画面維持 非対応',
    pressed: enabled,
    disabled: !WAKE_LOCK_SUPPORTED,
    status: statusOverride ?? defaultStatus({ enabled, active }),
    toggle,
  };
}
