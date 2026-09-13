import { useSyncExternalStore } from 'react';

const FALLBACK_STATE = Object.freeze({
  history: [],
  activity: [],
  activitySummary: '直近30日: 0回 · 0日活動',
});

function readSnapshot() {
  return globalThis.ONE_REACT_PROGRESS_DETAILS_STATE?.snapshot?.() ?? FALLBACK_STATE;
}

function subscribe(onStoreChange) {
  window.addEventListener('one:progress-details-state', onStoreChange);
  return () => {
    window.removeEventListener('one:progress-details-state', onStoreChange);
  };
}

export function useProgressDetailsState() {
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
