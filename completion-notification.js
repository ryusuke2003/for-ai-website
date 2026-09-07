const completionNotificationToggle = document.querySelector('#completion-notification-toggle');
const completionNotificationStatus = document.querySelector('#completion-notification-status');

const COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1';
const completionNotificationSupported = (
  'Notification' in window
  && typeof Notification.requestPermission === 'function'
);

function parseCompletionNotificationPreference(value) {
  if (value === '1') return true;
  if (value === '0' || value === null) return false;
  return null;
}

let completionNotificationEnabled = (
  completionNotificationSupported
  && Notification.permission === 'granted'
  && parseCompletionNotificationPreference(safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY)) === true
);
let activeCompletionNotification = null;

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

function persistCompletionNotificationPreference(enabled) {
  const value = enabled ? '1' : '0';
  if (!safeWrite(COMPLETION_NOTIFICATION_STORAGE_KEY, value)) return false;

  const persisted = safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY) === value;
  if (!persisted && !storageAccessFailed) reportStorageFailure();
  return persisted && !storageAccessFailed;
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

function showCompletionNotification() {
  if (
    !completionNotificationEnabled
    || !completionNotificationSupported
    || Notification.permission !== 'granted'
    || document.visibilityState === 'visible'
  ) {
    return;
  }

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

completionNotificationToggle.addEventListener('click', () => {
  if (completionNotificationEnabled) {
    disableCompletionNotification();
    return;
  }
  void enableCompletionNotification();
});

const finishTimerWithoutCompletionNotification = finishTimer;
finishTimer = function finishTimerWithCompletionNotification() {
  finishTimerWithoutCompletionNotification();
  showCompletionNotification();
};

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

window.addEventListener('pageshow', () => {
  if (completionNotificationSupported && Notification.permission !== 'granted') {
    completionNotificationEnabled = false;
  }
  syncCompletionNotificationUi();
});

syncCompletionNotificationUi();
