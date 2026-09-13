import { useSyncExternalStore } from 'react';

const FALLBACK_STATE = Object.freeze({
  doneLabel: 'タイマー完了後に記録できます',
  doneDisabled: true,
  discardHidden: true,
  todayCount: '0',
  weekCount: '0',
  streakCount: '0',
  streakAriaLabel: '0日',
  doneCount: '0',
  history: Object.freeze({}),
  streakStatus: '今日1回から連続記録を始められます。',
});

function readSnapshot() {
  return globalThis.ONE_REACT_PROGRESS_OVERVIEW_STATE?.snapshot?.() ?? FALLBACK_STATE;
}

function subscribe(onStoreChange) {
  function handleProgressState() {
    onStoreChange();
  }

  window.addEventListener('one:progress-overview-state', handleProgressState);
  return () => {
    window.removeEventListener('one:progress-overview-state', handleProgressState);
  };
}

export function useProgressOverviewState() {
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
