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
