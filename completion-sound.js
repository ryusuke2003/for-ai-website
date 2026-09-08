const completionSoundToggle = document.querySelector('#completion-sound-toggle');
const completionSoundStatus = document.querySelector('#completion-sound-status');
const completionNotificationToggle = document.querySelector('#completion-notification-toggle');
const completionNotificationStatus = document.querySelector('#completion-notification-status');

const COMPLETION_SOUND_STORAGE_KEY = 'one.completionSound.v1';
const COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1';
const COMPLETION_EFFECT_CLAIM_STORAGE_KEY = 'one.completionEffectClaim.v1';
const COMPLETION_EFFECT_LOCK_NAME = 'one-completion-effect-v1';
const COMPLETION_EFFECT_FALLBACK_SETTLE_MS = 80;
const MAX_COMPLETION_EFFECT_CLAIM_BYTES = 256;
const CompletionAudioContext = window.AudioContext || window.webkitAudioContext;
const completionNotificationSupported = (
  'Notification' in window
  && typeof Notification.requestPermission === 'function'
);

let completionEffectFallbackCounter = 0;

function parseCompletionSoundPreference(value) {
  if (value === '1') return true;
  if (value === '0' || value === null) return false;
  return null;
}

function parseCompletionNotificationPreference(value) {
  if (value === '1') return true;
  if (value === '0' || value === null) return false;
  return null;
}

function buildCompletionEffectKey(completionEndAt, minutes) {
  const endAtValue = Number.isFinite(completionEndAt) ? Math.trunc(completionEndAt) : null;
  if (!Number.isSafeInteger(endAtValue) || endAtValue <= 0) return null;
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES) return null;
  return `${endAtValue}:${minutes}`;
}

function createCompletionEffectClaimToken() {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(8);
      globalThis.crypto.getRandomValues(bytes);
      return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      // A claim token is not a secret. Fall back to a local uniqueness token below.
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
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES) return null;
    if (!isCompletionEffectClaimToken(value.soundClaim)) return null;
    if (!isCompletionEffectClaimToken(value.notificationClaim)) return null;
    if (!Number.isSafeInteger(value.updatedAt) || value.updatedAt <= 0) return null;
    return value;
  } catch {
    return null;
  }
}

let completionSoundEnabled = parseCompletionSoundPreference(safeRead(COMPLETION_SOUND_STORAGE_KEY)) === true;
let completionAudioContext = null;
let completionNotificationEnabled = (
  completionNotificationSupported
  && Notification.permission === 'granted'
  && parseCompletionNotificationPreference(safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY)) === true
);
let activeCompletionNotification = null;

function syncCompletionSoundUi(message = null) {
  const supported = typeof CompletionAudioContext === 'function';
  if (!supported) completionSoundEnabled = false;

  completionSoundToggle.disabled = !supported;
  completionSoundToggle.setAttribute('aria-pressed', String(completionSoundEnabled));
  completionSoundToggle.classList.toggle('active', completionSoundEnabled);
  completionSoundToggle.textContent = supported
    ? `完了音 ${completionSoundEnabled ? 'ON' : 'OFF'}`
    : '完了音 非対応';

  if (message !== null) {
    completionSoundStatus.textContent = message;
  } else if (!supported) {
    completionSoundStatus.textContent = 'このブラウザでは完了音を利用できません。';
  } else if (completionSoundEnabled) {
    completionSoundStatus.textContent = '完了音はオンです。タイマーが0:00になったときだけ短く鳴ります。';
  } else {
    completionSoundStatus.textContent = '完了音はオフです。オンにすると短い試聴音が鳴ります。';
  }
}

function syncCompletionNotificationUi(message = null) {
  if (!completionNotificationSupported) completionNotificationEnabled = false;
  if (completionNotificationSupported && Notification.permission !== 'granted') {
    completionNotificationEnabled = false;
  }

  completionNotificationToggle.disabled = !completionNotificationSupported;
  completionNotificationToggle.setAttribute('aria-pressed', String(completionNotificationEnabled));
  completionNotificationToggle.classList.toggle('active', completionNotificationEnabled);
  completionNotificationToggle.textContent = completionNotificationSupported
    ? `完了通知 ${completionNotificationEnabled ? 'ON' : 'OFF'}`
    : '完了通知 非対応';

  if (message !== null) {
    completionNotificationStatus.textContent = message;
  } else if (!completionNotificationSupported) {
    completionNotificationStatus.textContent = 'このブラウザではデスクトップ完了通知を利用できません。';
  } else if (Notification.permission === 'denied') {
    completionNotificationStatus.textContent = '完了通知はブラウザ設定で拒否されています。利用するにはサイトの通知権限を変更してください。';
  } else if (completionNotificationEnabled) {
    completionNotificationStatus.textContent = '完了通知はオンです。タイマー完了時にこのタブが背景なら通知します。';
  } else {
    completionNotificationStatus.textContent = '完了通知はオフです。オンにするとブラウザの通知許可を確認します。';
  }
}

function persistCompletionSoundPreference(enabled) {
  const value = enabled ? '1' : '0';
  if (!safeWrite(COMPLETION_SOUND_STORAGE_KEY, value)) return false;

  const persisted = safeRead(COMPLETION_SOUND_STORAGE_KEY) === value;
  if (!persisted && !storageAccessFailed) reportStorageFailure();
  return persisted && !storageAccessFailed;
}

function persistCompletionNotificationPreference(enabled) {
  const value = enabled ? '1' : '0';
  if (!safeWrite(COMPLETION_NOTIFICATION_STORAGE_KEY, value)) return false;

  const persisted = safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY) === value;
  if (!persisted && !storageAccessFailed) reportStorageFailure();
  return persisted && !storageAccessFailed;
}

function getCompletionAudioContext() {
  if (typeof CompletionAudioContext !== 'function') return null;
  if (!completionAudioContext || completionAudioContext.state === 'closed') {
    try {
      completionAudioContext = new CompletionAudioContext();
    } catch {
      completionAudioContext = null;
      return null;
    }
  }
  return completionAudioContext;
}

async function unlockCompletionAudio() {
  const context = getCompletionAudioContext();
  if (!context) return null;

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      return null;
    }
  }

  return context.state === 'running' ? context : null;
}

function scheduleCompletionChime(context) {
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
}

async function playCompletionSound({ preview = false, previewMessage = null } = {}) {
  if (!completionSoundEnabled) return;

  const context = await unlockCompletionAudio();
  if (!context || !scheduleCompletionChime(context)) {
    syncCompletionSoundUi('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
    return;
  }

  if (preview) {
    syncCompletionSoundUi(
      previewMessage ?? '完了音をオンにしました。いまの短い音がタイマー完了時に鳴ります。',
    );
  }
}

function closeActiveCompletionNotification() {
  if (!activeCompletionNotification) return;
  try {
    activeCompletionNotification.close();
  } catch {
    // The browser may already have closed the notification.
  }
  activeCompletionNotification = null;
}

function refreshCompletionNotificationFromBrowser({ closeVisibleNotification = false } = {}) {
  if (!completionNotificationSupported) {
    completionNotificationEnabled = false;
    syncCompletionNotificationUi();
    return;
  }

  if (closeVisibleNotification && document.visibilityState === 'visible') {
    closeActiveCompletionNotification();
  }

  if (Notification.permission !== 'granted') {
    completionNotificationEnabled = false;
    syncCompletionNotificationUi();
    return;
  }

  if (!storageAccessFailed) {
    const storedPreference = safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY);
    if (!storageAccessFailed) {
      completionNotificationEnabled = parseCompletionNotificationPreference(storedPreference) === true;
    }
  }

  syncCompletionNotificationUi();
}

function canShowCompletionNotification() {
  return completionNotificationEnabled
    && completionNotificationSupported
    && Notification.permission === 'granted'
    && document.visibilityState !== 'visible';
}

function showCompletionNotification() {
  if (!canShowCompletionNotification()) return;

  closeActiveCompletionNotification();
  try {
    const notification = new Notification('集中スプリント完了', {
      body: 'ONEで完了した集中を記録してください。',
      tag: 'one-focus-complete',
    });
    activeCompletionNotification = notification;
    notification.addEventListener('click', () => {
      window.focus();
      closeActiveCompletionNotification();
    }, { once: true });
    notification.addEventListener('close', () => {
      if (activeCompletionNotification === notification) activeCompletionNotification = null;
    }, { once: true });
  } catch {
    syncCompletionNotificationUi('完了通知を表示できませんでした。タイマー機能はそのまま利用できます。');
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
  if (storageAccessFailed) return true;

  const claimField = effect === 'sound'
    ? 'soundClaim'
    : effect === 'notification'
      ? 'notificationClaim'
      : null;
  if (claimField === null) return false;

  const raw = safeRead(COMPLETION_EFFECT_CLAIM_STORAGE_KEY);
  if (storageAccessFailed) return true;
  const previousClaim = parseCompletionEffectClaim(raw);
  if (previousClaim?.key === completionKey && previousClaim[claimField] !== null) return false;

  const claimToken = createCompletionEffectClaimToken();
  const payload = completionEffectClaimPayload(completionKey, claimField, claimToken, previousClaim);
  if (!safeWrite(COMPLETION_EFFECT_CLAIM_STORAGE_KEY, payload)) return true;

  if (settle) {
    await new Promise((resolve) => window.setTimeout(resolve, COMPLETION_EFFECT_FALLBACK_SETTLE_MS));
  }

  const persistedRaw = safeRead(COMPLETION_EFFECT_CLAIM_STORAGE_KEY);
  if (storageAccessFailed) return true;
  const persisted = parseCompletionEffectClaim(persistedRaw);
  return persisted?.key === completionKey && persisted[claimField] === claimToken;
}

async function claimCompletionEffect(completionKey, effect) {
  if (completionKey === null) return true;

  if (navigator.locks && typeof navigator.locks.request === 'function' && !storageAccessFailed) {
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

async function runCompletionEffectsOnce(completionKey) {
  if (completionSoundEnabled) {
    const context = await unlockCompletionAudio();
    if (!context) {
      syncCompletionSoundUi('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
    } else if (await claimCompletionEffect(completionKey, 'sound')) {
      if (!scheduleCompletionChime(context)) {
        syncCompletionSoundUi('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
      }
    }
  }

  if (canShowCompletionNotification() && await claimCompletionEffect(completionKey, 'notification')) {
    showCompletionNotification();
  }
}

async function toggleCompletionSound() {
  if (typeof CompletionAudioContext !== 'function') return;

  if (completionSoundEnabled) {
    completionSoundEnabled = false;
    const persisted = persistCompletionSoundPreference(false);
    syncCompletionSoundUi(
      persisted
        ? '完了音をオフにしました。'
        : '完了音をオフにしましたが、このブラウザには設定を保存できませんでした。再読み込みすると以前の設定へ戻る可能性があります。',
    );
    return;
  }

  const context = await unlockCompletionAudio();
  if (!context) {
    completionSoundEnabled = false;
    syncCompletionSoundUi('完了音を有効にできませんでした。タイマー機能はそのまま利用できます。');
    return;
  }

  completionSoundEnabled = true;
  const persisted = persistCompletionSoundPreference(true);
  syncCompletionSoundUi();
  await playCompletionSound({
    preview: true,
    previewMessage: persisted
      ? '完了音をオンにしました。いまの短い音がタイマー完了時に鳴ります。'
      : '完了音をオンにしました。今のタブでは鳴りますが、このブラウザには設定を保存できませんでした。再読み込みすると以前の設定へ戻る可能性があります。',
  });
}

async function enableCompletionNotification() {
  if (!completionNotificationSupported) return;

  let permission = Notification.permission;
  if (permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'denied';
    }
  }

  if (permission !== 'granted') {
    completionNotificationEnabled = false;
    persistCompletionNotificationPreference(false);
    syncCompletionNotificationUi(
      permission === 'denied'
        ? '通知が許可されなかったため完了通知はオフのままです。ブラウザ設定から変更できます。'
        : '通知が許可されなかったため完了通知はオフのままです。',
    );
    return;
  }

  completionNotificationEnabled = true;
  const persisted = persistCompletionNotificationPreference(true);
  syncCompletionNotificationUi(
    persisted
      ? '完了通知をオンにしました。このタブが背景のときだけタイマー完了を通知します。'
      : '完了通知をオンにしました。今のタブでは利用できますが、このブラウザには設定を保存できませんでした。',
  );
}

function disableCompletionNotification() {
  completionNotificationEnabled = false;
  closeActiveCompletionNotification();
  const persisted = persistCompletionNotificationPreference(false);
  syncCompletionNotificationUi(
    persisted
      ? '完了通知をオフにしました。'
      : '完了通知をオフにしましたが、このブラウザには設定を保存できませんでした。',
  );
}

function primeCompletionAudioFromGesture() {
  if (!completionSoundEnabled) return;
  void unlockCompletionAudio();
}

const finishTimerWithoutCompletionSound = finishTimer;
finishTimer = function finishTimerWithCompletionSound() {
  const completionKey = buildCompletionEffectKey(endAt, selectedMinutes);
  finishTimerWithoutCompletionSound();
  void runCompletionEffectsOnce(completionKey);
};

completionSoundToggle.addEventListener('click', () => {
  void toggleCompletionSound();
});

completionNotificationToggle.addEventListener('click', () => {
  if (completionNotificationEnabled) {
    disableCompletionNotification();
    return;
  }
  void enableCompletionNotification();
});

document.addEventListener('pointerdown', primeCompletionAudioFromGesture, true);
document.addEventListener('keydown', primeCompletionAudioFromGesture, true);

window.addEventListener('storage', (event) => {
  if (event.key !== COMPLETION_SOUND_STORAGE_KEY) return;

  const nextEnabled = parseCompletionSoundPreference(event.newValue);
  if (nextEnabled === null) return;

  completionSoundEnabled = nextEnabled;
  syncCompletionSoundUi(
    nextEnabled
      ? '別のタブで完了音がオンになりました。次のタイマー完了からこのタブにも反映します。'
      : '別のタブで完了音がオフになりました。このタブにも反映しました。',
  );
});

window.addEventListener('storage', (event) => {
  if (event.key !== COMPLETION_NOTIFICATION_STORAGE_KEY) return;

  const nextEnabled = parseCompletionNotificationPreference(event.newValue);
  if (nextEnabled === null) return;

  completionNotificationEnabled = nextEnabled && Notification.permission === 'granted';
  if (!completionNotificationEnabled) closeActiveCompletionNotification();
  syncCompletionNotificationUi(
    completionNotificationEnabled
      ? '別のタブで完了通知がオンになりました。このタブにも反映しました。'
      : '別のタブで完了通知がオフになりました。このタブにも反映しました。',
  );
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true });
});

window.addEventListener('pageshow', () => {
  refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true });
});

syncCompletionSoundUi();
syncCompletionNotificationUi();
