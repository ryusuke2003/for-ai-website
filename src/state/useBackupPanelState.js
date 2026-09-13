import { useSyncExternalStore } from 'react';

const FALLBACK_STATE = Object.freeze({
  importDisabled: false,
  undoHidden: true,
  undoDisabled: false,
  backupStatus: '',
  resetButtonHidden: false,
  resetConfirmHidden: true,
  resetConfirmDisabled: false,
  resetCancelDisabled: false,
  resetStatus: '',
});

function readSnapshot() {
  return globalThis.ONE_REACT_BACKUP_PANEL_STATE?.snapshot?.() ?? FALLBACK_STATE;
}

function subscribe(onStoreChange) {
  window.addEventListener('one:backup-panel-state', onStoreChange);
  return () => {
    window.removeEventListener('one:backup-panel-state', onStoreChange);
  };
}

export function useBackupPanelState() {
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
