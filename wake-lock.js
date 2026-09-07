const wakeLockToggle = document.querySelector('#wake-lock-toggle');
const wakeLockStatus = document.querySelector('#wake-lock-status');

const WAKE_LOCK_STORAGE_KEY = 'one.wakeLock.v1';
const wakeLockSupported = 'wakeLock' in navigator && typeof navigator.wakeLock?.request === 'function';

function parseWakeLockPreference(value) {
  if (value === '1') return true;
  if (value === '0' || value === null) return false;
  return null;
}

let wakeLockEnabled = parseWakeLockPreference(safeRead(WAKE_LOCK_STORAGE_KEY)) === true;
let wakeLockSentinel = null;
let wakeLockRequestPending = false;

function timerIsRunningForWakeLock() {
  return timerId !== null && endAt !== null && remainingSeconds > 0;
}

function syncWakeLockUi(message = null) {
  if (!wakeLockSupported) wakeLockEnabled = false;

  wakeLockToggle.disabled = !wakeLockSupported;
  wakeLockToggle.setAttribute('aria-pressed', String(wakeLockEnabled));
  wakeLockToggle.classList.toggle('active', wakeLockEnabled);
  wakeLockToggle.textContent = wakeLockSupported
    ? `画面維持 ${wakeLockEnabled ? 'ON' : 'OFF'}`
    : '画面維持 非対応';

  if (message !== null) {
    wakeLockStatus.textContent = message;
  } else if (!wakeLockSupported) {
    wakeLockStatus.textContent = 'このブラウザでは集中中の画面維持を利用できません。';
  } else if (!wakeLockEnabled) {
    wakeLockStatus.textContent = '画面維持はオフです。オンにすると集中中だけ画面のスリープを抑えます。';
  } else if (wakeLockSentinel) {
    wakeLockStatus.textContent = '集中中の画面維持を有効にしています。';
  } else {
    wakeLockStatus.textContent = '画面維持はオンです。タイマー開始中だけ有効になります。';
  }
}

function persistWakeLockPreference(enabled) {
  const value = enabled ? '1' : '0';
  if (!safeWrite(WAKE_LOCK_STORAGE_KEY, value)) return false;

  const persisted = safeRead(WAKE_LOCK_STORAGE_KEY) === value;
  if (!persisted && !storageAccessFailed) reportStorageFailure();
  return persisted && !storageAccessFailed;
}

async function releaseWakeLock() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (!sentinel || sentinel.released) return;

  try {
    await sentinel.release();
  } catch {
    // The browser or OS may already have released the lock.
  }
}

async function requestWakeLock() {
  if (
    !wakeLockSupported
    || !wakeLockEnabled
    || !timerIsRunningForWakeLock()
    || document.visibilityState !== 'visible'
    || wakeLockSentinel
    || wakeLockRequestPending
  ) {
    return;
  }

  wakeLockRequestPending = true;
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    if (!wakeLockEnabled || !timerIsRunningForWakeLock() || document.visibilityState !== 'visible') {
      try {
        await sentinel.release();
      } catch {
        // The browser may already have released the newly-created lock.
      }
      return;
    }

    wakeLockSentinel = sentinel;
    sentinel.addEventListener('release', () => {
      if (wakeLockSentinel === sentinel) wakeLockSentinel = null;
      syncWakeLockUi(
        wakeLockEnabled && timerIsRunningForWakeLock()
          ? '画面維持が解除されました。画面へ戻ったときに再試行します。'
          : null,
      );
    }, { once: true });
    syncWakeLockUi();
  } catch {
    syncWakeLockUi('画面維持を有効にできませんでした。タイマー機能はそのまま利用できます。');
  } finally {
    wakeLockRequestPending = false;
  }
}

async function syncWakeLockWithTimer() {
  if (!wakeLockEnabled || !timerIsRunningForWakeLock() || document.visibilityState !== 'visible') {
    await releaseWakeLock();
    syncWakeLockUi();
    return;
  }

  await requestWakeLock();
}

async function toggleWakeLock() {
  if (!wakeLockSupported) return;

  wakeLockEnabled = !wakeLockEnabled;
  const persisted = persistWakeLockPreference(wakeLockEnabled);

  if (!wakeLockEnabled) {
    await releaseWakeLock();
    syncWakeLockUi(
      persisted
        ? '画面維持をオフにしました。'
        : '画面維持をオフにしましたが、このブラウザには設定を保存できませんでした。',
    );
    return;
  }

  await syncWakeLockWithTimer();
  syncWakeLockUi(
    persisted
      ? timerIsRunningForWakeLock()
        ? '画面維持をオンにしました。集中中は画面のスリープを抑えます。'
        : '画面維持をオンにしました。タイマー開始中だけ有効になります。'
      : '画面維持をオンにしましたが、このブラウザには設定を保存できませんでした。今のタブでは利用できます。',
  );
}

const wakeLockTimerObserver = new MutationObserver(() => {
  void syncWakeLockWithTimer();
});
wakeLockTimerObserver.observe(timerCard, { attributes: true, attributeFilter: ['class'] });

wakeLockToggle.addEventListener('click', () => {
  void toggleWakeLock();
});

document.addEventListener('visibilitychange', () => {
  void syncWakeLockWithTimer();
});

window.addEventListener('pagehide', () => {
  void releaseWakeLock();
});

window.addEventListener('storage', (event) => {
  if (event.key !== WAKE_LOCK_STORAGE_KEY) return;

  const nextEnabled = parseWakeLockPreference(event.newValue);
  if (nextEnabled === null) return;

  wakeLockEnabled = nextEnabled;
  void syncWakeLockWithTimer();
  syncWakeLockUi(
    nextEnabled
      ? '別のタブで画面維持がオンになりました。このタブにも反映しました。'
      : '別のタブで画面維持がオフになりました。このタブにも反映しました。',
  );
});

syncWakeLockUi();
void syncWakeLockWithTimer();
