import { useCallback, useEffect, useRef, useState } from 'react';

const COMPLETION_SOUND_STORAGE_KEY = 'one.completionSound.v1';
const COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1';
const COMPLETION_EFFECT_CLAIM_STORAGE_KEY = 'one.completionEffectClaim.v1';
const COMPLETION_EFFECT_LOCK_NAME = 'one-completion-effect-v1';
const COMPLETION_EFFECT_FALLBACK_SETTLE_MS = 80;
const MAX_COMPLETION_EFFECT_CLAIM_BYTES = 256;
const MAX_TIMER_MINUTES = 180;
const CompletionAudioContext = window.AudioContext || window.webkitAudioContext;
const SOUND_SUPPORTED = typeof CompletionAudioContext === 'function';
const NOTIFICATION_SUPPORTED = (
  'Notification' in window
  && typeof Notification.requestPermission === 'function'
);

let completionEffectFallbackCounter = 0;

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function readStorage(key) {
  try {
    return { ok: true, value: localStorage.getItem(key) };
  } catch {
    reportStorageFailure();
    return { ok: false, value: null };
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    reportStorageFailure();
    return false;
  }
}

function parsePreference(value) {
  if (value === '1') return true;
  if (value === '0' || value === null) return false;
  return null;
}

function readPreference(key) {
  const result = readStorage(key);
  if (!result.ok) return { ok: false, enabled: null };
  return { ok: true, enabled: parsePreference(result.value) };
}

function persistPreference(key, enabled) {
  const value = enabled ? '1' : '0';
  if (!writeStorage(key, value)) return false;

  const persisted = readStorage(key);
  if (persisted.ok && persisted.value === value) return true;
  if (persisted.ok) reportStorageFailure();
  return false;
}

function buildCompletionEffectKey(completionEndAt, minutes) {
  const endAtValue = Number.isFinite(completionEndAt) ? Math.trunc(completionEndAt) : null;
  if (!Number.isSafeInteger(endAtValue) || endAtValue <= 0) return null;
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_TIMER_MINUTES) return null;
  return `${endAtValue}:${minutes}`;
}

function createCompletionEffectClaimToken() {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(8);
      globalThis.crypto.getRandomValues(bytes);
      return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      // The claim is not secret; local uniqueness is enough for the fallback.
    }
  }

  completionEffectFallbackCounter = (completionEffectFallbackCounter + 1) % 1_000_000;
  return `fallback-${Date.now().toString(36)}-${completionEffectFallbackCounter.toString(36)}`;
}

function isCompletionEffectClaimToken(value) {
  return value === null
    || (typeof value === 'string' && /^[a-z0-9-]{8,80}$/.test(value));
}

function parseCompletionEffectClaim(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_COMPLETION_EFFECT_CLAIM_BYTES) return null;

  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    if (
      Object.keys(value).length !== 4
      || !Object.hasOwn(value, 'key')
      || !Object.hasOwn(value, 'soundClaim')
      || !Object.hasOwn(value, 'notificationClaim')
      || !Object.hasOwn(value, 'updatedAt')
    ) {
      return null;
    }
    if (typeof value.key !== 'string' || !/^\d{10,16}:\d{1,3}$/.test(value.key)) return null;

    const [endAtRaw, minutesRaw] = value.key.split(':');
    const endAtValue = Number(endAtRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isSafeInteger(endAtValue) || endAtValue <= 0) return null;
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_TIMER_MINUTES) return null;
    if (!isCompletionEffectClaimToken(value.soundClaim)) return null;
    if (!isCompletionEffectClaimToken(value.notificationClaim)) return null;
    if (!Number.isSafeInteger(value.updatedAt) || value.updatedAt <= 0) return null;
    return value;
  } catch {
    return null;
  }
}

function completionEffectClaimPayload(completionKey, claimField, claimToken, previousClaim) {
  const sameCompletion = previousClaim?.key === completionKey;
  const next = {
    key: completionKey,
    soundClaim: sameCompletion ? previousClaim.soundClaim : null,
    notificationClaim: sameCompletion ? previousClaim.notificationClaim : null,
    updatedAt: Date.now(),
  };
  next[claimField] = claimToken;
  return JSON.stringify(next);
}

async function claimCompletionEffectWithStorage(completionKey, effect, { settle = false } = {}) {
  const claimField = effect === 'sound'
    ? 'soundClaim'
    : effect === 'notification'
      ? 'notificationClaim'
      : null;
  if (claimField === null) return false;

  const stored = readStorage(COMPLETION_EFFECT_CLAIM_STORAGE_KEY);
  if (!stored.ok) return true;
  const previousClaim = parseCompletionEffectClaim(stored.value);
  if (previousClaim?.key === completionKey && previousClaim[claimField] !== null) return false;

  const claimToken = createCompletionEffectClaimToken();
  const payload = completionEffectClaimPayload(completionKey, claimField, claimToken, previousClaim);
  if (!writeStorage(COMPLETION_EFFECT_CLAIM_STORAGE_KEY, payload)) return true;

  if (settle) {
    await new Promise((resolve) => window.setTimeout(resolve, COMPLETION_EFFECT_FALLBACK_SETTLE_MS));
  }

  const persisted = readStorage(COMPLETION_EFFECT_CLAIM_STORAGE_KEY);
  if (!persisted.ok) return true;
  const parsed = parseCompletionEffectClaim(persisted.value);
  return parsed?.key === completionKey && parsed[claimField] === claimToken;
}

async function claimCompletionEffect(completionKey, effect) {
  if (completionKey === null) return true;

  if (navigator.locks && typeof navigator.locks.request === 'function') {
    try {
      return await navigator.locks.request(
        COMPLETION_EFFECT_LOCK_NAME,
        () => claimCompletionEffectWithStorage(completionKey, effect),
      );
    } catch {
      // Fall through to a storage-only best-effort claim.
    }
  }

  return claimCompletionEffectWithStorage(completionKey, effect, { settle: true });
}

function soundDefaultStatus(enabled) {
  if (!SOUND_SUPPORTED) return 'このブラウザでは完了音を利用できません。';
  return enabled
    ? '完了音はオンです。タイマーが0:00になったときだけ短く鳴ります。'
    : '完了音はオフです。オンにすると短い試聴音が鳴ります。';
}

function notificationDefaultStatus(enabled) {
  if (!NOTIFICATION_SUPPORTED) return 'このブラウザではデスクトップ完了通知を利用できません。';
  if (Notification.permission === 'denied') {
    return '完了通知はブラウザ設定で拒否されています。利用するにはサイトの通知権限を変更してください。';
  }
  return enabled
    ? '完了通知はオンです。タイマー完了時にこのタブが背景なら通知します。'
    : '完了通知はオフです。オンにするとブラウザの通知許可を確認します。';
}

export function useCompletionEffectsControl(timerState) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundStatusOverride, setSoundStatusOverride] = useState(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationStatusOverride, setNotificationStatusOverride] = useState(null);
  const soundEnabledRef = useRef(false);
  const notificationEnabledRef = useRef(false);
  const audioContextRef = useRef(null);
  const activeNotificationRef = useRef(null);
  const previousTimerStateRef = useRef(timerState);
  const mountedRef = useRef(true);

  const closeActiveNotification = useCallback(() => {
    const notification = activeNotificationRef.current;
    activeNotificationRef.current = null;
    if (!notification) return;
    try {
      notification.close();
    } catch {
      // The browser may already have closed it.
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (!SOUND_SUPPORTED) return null;
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        audioContextRef.current = new CompletionAudioContext();
      } catch {
        audioContextRef.current = null;
      }
    }
    return audioContextRef.current;
  }, []);

  const unlockCompletionAudio = useCallback(async () => {
    const context = getAudioContext();
    if (!context) return null;
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        return null;
      }
    }
    return context.state === 'running' ? context : null;
  }, [getAudioContext]);

  const scheduleCompletionChime = useCallback((context) => {
    try {
      const tones = [
        { frequency: 660, offset: 0, duration: 0.11 },
        { frequency: 880, offset: 0.14, duration: 0.16 },
      ];
      tones.forEach(({ frequency, offset, duration }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + offset;
        const end = start + duration;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.035, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const canShowNotification = useCallback(() => (
    notificationEnabledRef.current
    && NOTIFICATION_SUPPORTED
    && Notification.permission === 'granted'
    && document.visibilityState !== 'visible'
  ), []);

  const showCompletionNotification = useCallback(() => {
    if (!canShowNotification()) return;
    closeActiveNotification();
    try {
      const notification = new Notification('集中スプリント完了', {
        body: 'ONEで完了した集中を記録してください。',
        tag: 'one-focus-complete',
      });
      activeNotificationRef.current = notification;
      notification.addEventListener('click', () => {
        window.focus();
        closeActiveNotification();
      }, { once: true });
      notification.addEventListener('close', () => {
        if (activeNotificationRef.current === notification) activeNotificationRef.current = null;
      }, { once: true });
    } catch {
      if (mountedRef.current) {
        setNotificationStatusOverride('完了通知を表示できませんでした。タイマー機能はそのまま利用できます。');
      }
    }
  }, [canShowNotification, closeActiveNotification]);

  const runCompletionEffectsOnce = useCallback(async (completionKey) => {
    if (soundEnabledRef.current) {
      const context = await unlockCompletionAudio();
      if (!context) {
        if (mountedRef.current) {
          setSoundStatusOverride('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
        }
      } else if (await claimCompletionEffect(completionKey, 'sound')) {
        if (!scheduleCompletionChime(context) && mountedRef.current) {
          setSoundStatusOverride('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
        }
      }
    }

    if (canShowNotification() && await claimCompletionEffect(completionKey, 'notification')) {
      showCompletionNotification();
    }
  }, [canShowNotification, scheduleCompletionChime, showCompletionNotification, unlockCompletionAudio]);

  useEffect(() => {
    mountedRef.current = true;

    function applyStoredSound() {
      const stored = readPreference(COMPLETION_SOUND_STORAGE_KEY);
      if (!stored.ok || stored.enabled === null) return;
      soundEnabledRef.current = SOUND_SUPPORTED && stored.enabled;
      setSoundEnabled(soundEnabledRef.current);
      setSoundStatusOverride(null);
    }

    function refreshNotification({ closeVisible = false } = {}) {
      if (closeVisible && document.visibilityState === 'visible') closeActiveNotification();
      if (!NOTIFICATION_SUPPORTED || Notification.permission !== 'granted') {
        notificationEnabledRef.current = false;
        setNotificationEnabled(false);
        setNotificationStatusOverride(null);
        return;
      }

      const stored = readPreference(COMPLETION_NOTIFICATION_STORAGE_KEY);
      if (!stored.ok || stored.enabled === null) return;
      notificationEnabledRef.current = stored.enabled;
      setNotificationEnabled(stored.enabled);
      setNotificationStatusOverride(null);
    }

    function refreshWhenVisible() {
      if (document.visibilityState !== 'visible') return;
      applyStoredSound();
      refreshNotification({ closeVisible: true });
    }

    function handlePageShow() {
      applyStoredSound();
      refreshNotification({ closeVisible: true });
    }

    function handleStorage(event) {
      if (event.key === COMPLETION_SOUND_STORAGE_KEY) {
        const nextEnabled = parsePreference(event.newValue);
        if (nextEnabled === null) return;
        soundEnabledRef.current = SOUND_SUPPORTED && nextEnabled;
        setSoundEnabled(soundEnabledRef.current);
        setSoundStatusOverride(
          nextEnabled
            ? '別のタブで完了音がオンになりました。次のタイマー完了からこのタブにも反映します。'
            : '別のタブで完了音がオフになりました。このタブにも反映しました。',
        );
        return;
      }

      if (event.key !== COMPLETION_NOTIFICATION_STORAGE_KEY) return;
      const nextEnabled = parsePreference(event.newValue);
      if (nextEnabled === null) return;
      const permissionGranted = NOTIFICATION_SUPPORTED && Notification.permission === 'granted';
      notificationEnabledRef.current = nextEnabled && permissionGranted;
      setNotificationEnabled(notificationEnabledRef.current);
      if (!notificationEnabledRef.current) closeActiveNotification();
      setNotificationStatusOverride(
        !nextEnabled
          ? '別のタブで完了通知がオフになりました。このタブにも反映しました。'
          : !NOTIFICATION_SUPPORTED
            ? '別のタブで完了通知がオンになりましたが、このブラウザでは完了通知を利用できません。'
            : !permissionGranted
              ? '別のタブで完了通知がオンになりましたが、このタブでは通知が許可されていません。'
              : '別のタブで完了通知がオンになりました。このタブにも反映しました。',
      );
    }

    function primeAudioFromGesture() {
      if (soundEnabledRef.current) void unlockCompletionAudio();
    }

    applyStoredSound();
    refreshNotification();
    document.addEventListener('pointerdown', primeAudioFromGesture, true);
    document.addEventListener('keydown', primeAudioFromGesture, true);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('storage', handleStorage);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('pointerdown', primeAudioFromGesture, true);
      document.removeEventListener('keydown', primeAudioFromGesture, true);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('storage', handleStorage);
      closeActiveNotification();
    };
  }, [closeActiveNotification, unlockCompletionAudio]);

  useEffect(() => {
    const previous = previousTimerStateRef.current;
    previousTimerStateRef.current = timerState;
    const justCompleted = (
      previous?.running === true
      && timerState.running === false
      && timerState.completionReady === true
      && timerState.remainingSeconds === 0
    );
    if (!justCompleted) return;

    const completionKey = buildCompletionEffectKey(previous.endAt, previous.selectedMinutes);
    void runCompletionEffectsOnce(completionKey);
  }, [runCompletionEffectsOnce, timerState]);

  async function toggleSound() {
    if (!SOUND_SUPPORTED) return;

    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      const persisted = persistPreference(COMPLETION_SOUND_STORAGE_KEY, false);
      setSoundStatusOverride(
        persisted
          ? '完了音をオフにしました。'
          : '完了音をオフにしましたが、このブラウザには設定を保存できませんでした。再読み込みすると以前の設定へ戻る可能性があります。',
      );
      return;
    }

    const context = await unlockCompletionAudio();
    if (!context) {
      setSoundStatusOverride('完了音を有効にできませんでした。タイマー機能はそのまま利用できます。');
      return;
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);
    const persisted = persistPreference(COMPLETION_SOUND_STORAGE_KEY, true);
    if (!scheduleCompletionChime(context)) {
      setSoundStatusOverride('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
      return;
    }
    setSoundStatusOverride(
      persisted
        ? '完了音をオンにしました。いまの短い音がタイマー完了時に鳴ります。'
        : '完了音をオンにしました。今のタブでは鳴りますが、このブラウザには設定を保存できませんでした。再読み込みすると以前の設定へ戻る可能性があります。',
    );
  }

  async function toggleNotification() {
    if (!NOTIFICATION_SUPPORTED) return;

    if (notificationEnabledRef.current) {
      notificationEnabledRef.current = false;
      setNotificationEnabled(false);
      closeActiveNotification();
      const persisted = persistPreference(COMPLETION_NOTIFICATION_STORAGE_KEY, false);
      setNotificationStatusOverride(
        persisted
          ? '完了通知をオフにしました。'
          : '完了通知をオフにしましたが、このブラウザには設定を保存できませんでした。',
      );
      return;
    }

    let permission = Notification.permission;
    if (permission !== 'granted') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = 'denied';
      }
    }

    if (permission !== 'granted') {
      notificationEnabledRef.current = false;
      setNotificationEnabled(false);
      persistPreference(COMPLETION_NOTIFICATION_STORAGE_KEY, false);
      setNotificationStatusOverride(
        permission === 'denied'
          ? '通知が許可されなかったため完了通知はオフのままです。ブラウザ設定から変更できます。'
          : '通知が許可されなかったため完了通知はオフのままです。',
      );
      return;
    }

    notificationEnabledRef.current = true;
    setNotificationEnabled(true);
    const persisted = persistPreference(COMPLETION_NOTIFICATION_STORAGE_KEY, true);
    setNotificationStatusOverride(
      persisted
        ? '完了通知をオンにしました。このタブが背景のときだけタイマー完了を通知します。'
        : '完了通知をオンにしました。今のタブでは利用できますが、このブラウザには設定を保存できませんでした。',
    );
  }

  return {
    sound: {
      label: SOUND_SUPPORTED ? `完了音 ${soundEnabled ? 'ON' : 'OFF'}` : '完了音 非対応',
      pressed: soundEnabled,
      disabled: !SOUND_SUPPORTED,
      status: soundStatusOverride ?? soundDefaultStatus(soundEnabled),
      toggle: toggleSound,
    },
    notification: {
      label: NOTIFICATION_SUPPORTED ? `完了通知 ${notificationEnabled ? 'ON' : 'OFF'}` : '完了通知 非対応',
      pressed: notificationEnabled,
      disabled: !NOTIFICATION_SUPPORTED,
      status: notificationStatusOverride ?? notificationDefaultStatus(notificationEnabled),
      toggle: toggleNotification,
    },
  };
}
