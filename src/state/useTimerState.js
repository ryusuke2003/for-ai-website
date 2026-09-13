import { useSyncExternalStore } from 'react';

const FALLBACK_STATE = Object.freeze({
  selectedMinutes: 25,
  remainingSeconds: 25 * 60,
  running: false,
  endAt: null,
  completionReady: false,
  completionDate: null,
  focusMode: false,
  feedback: '準備できたらスタート。',
  feedbackState: 'idle',
});

function readSnapshot() {
  return globalThis.ONE_REACT_TIMER_STATE?.snapshot?.() ?? FALLBACK_STATE;
}

function subscribe(onStoreChange) {
  function handleTimerState() {
    onStoreChange();
  }

  window.addEventListener('one:timer-state', handleTimerState);
  return () => {
    window.removeEventListener('one:timer-state', handleTimerState);
  };
}

export function useTimerState() {
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
