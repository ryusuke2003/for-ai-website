import { useSyncExternalStore } from 'react';

const FALLBACK_STATE = Object.freeze({
  presets: [
    { minutes: 10, label: '10分', active: false, pressed: false, disabled: false },
    { minutes: 25, label: '25分', active: true, pressed: true, disabled: false },
    { minutes: 50, label: '50分', active: false, pressed: false, disabled: false },
  ],
  customValue: '25',
  customInvalid: false,
  customDisabled: false,
  customApplyDisabled: false,
  customStatus: '1〜180分の整数でも設定できます。',
  soundLabel: '完了音 OFF',
  soundPressed: false,
  soundDisabled: false,
  soundStatus: '完了音はオフです。オンにすると短い試聴音が鳴ります。',
  notificationLabel: '完了通知 OFF',
  notificationPressed: false,
  notificationDisabled: false,
  notificationStatus: '完了通知はオフです。オンにするとブラウザの通知許可を確認します。',
  wakeLockLabel: '画面維持 OFF',
  wakeLockPressed: false,
  wakeLockDisabled: false,
  wakeLockStatus: '画面維持はオフです。オンにすると集中中だけ画面のスリープを抑えます。',
});

function readSnapshot() {
  return globalThis.ONE_REACT_TIMER_SETTINGS_STATE?.snapshot?.() ?? FALLBACK_STATE;
}

function subscribe(onStoreChange) {
  function handleSettingsState() {
    onStoreChange();
  }

  window.addEventListener('one:timer-settings-state', handleSettingsState);
  return () => {
    window.removeEventListener('one:timer-settings-state', handleSettingsState);
  };
}

export function useTimerSettingsState() {
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
