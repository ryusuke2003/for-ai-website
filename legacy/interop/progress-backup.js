// Temporary compatibility layer for backup UI.
if (document.documentElement.dataset.reactBackupPanel === '1') {
  let backupPanelSnapshot = null;
  let backupPanelSerialized = '';

  function buildBackupPanelSnapshot() {
    return {
      importDisabled: backupImportButton.disabled,
      undoHidden: backupUndoButton.hidden,
      undoDisabled: backupUndoButton.disabled,
      backupStatus: backupStatus.textContent ?? '',
    };
  }

  function refreshBackupPanel({ force = false } = {}) {
    const next = buildBackupPanelSnapshot();
    const serialized = JSON.stringify(next);
    if (!force && serialized === backupPanelSerialized) return;

    backupPanelSerialized = serialized;
    backupPanelSnapshot = Object.freeze(next);
    window.dispatchEvent(new CustomEvent('one:backup-panel-state', {
      detail: backupPanelSnapshot,
    }));
  }

  function wrapBackupMutation(name) {
    const original = globalThis[name];
    if (typeof original !== 'function') return;

    globalThis[name] = function reactBackupAwareMutation(...args) {
      const result = original.apply(this, args);
      const refresh = () => refreshBackupPanel();
      if (result && typeof result.finally === 'function') {
        void result.finally(refresh);
      } else {
        refresh();
      }
      return result;
    };
  }

  for (const functionName of [
    'setBackupStatus',
    'refreshBackupControlAvailability',
    'refreshRecoveryAvailability',
  ]) {
    wrapBackupMutation(functionName);
  }

  window.addEventListener('one:progress-overview-state', () => refreshBackupPanel());
  window.addEventListener('one:timer-state', () => refreshBackupPanel());
  window.addEventListener('storage', () => refreshBackupPanel());
  window.addEventListener('pageshow', () => refreshBackupPanel());
  window.addEventListener('one:storage-error', () => refreshBackupPanel());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshBackupPanel();
  });

  globalThis.ONE_REACT_BACKUP_PANEL_STATE = Object.freeze({
    snapshot() {
      return backupPanelSnapshot;
    },
  });

  function forwardDetachedFocus(element, control) {
    const nativeFocus = element.focus.bind(element);
    element.focus = (options) => {
      if (element.isConnected) {
        nativeFocus(options);
        return;
      }

      window.dispatchEvent(new CustomEvent('one:backup-panel-focus', {
        detail: { control },
      }));
    };
  }

  forwardDetachedFocus(backupExportButton, 'export');
  forwardDetachedFocus(backupUndoButton, 'undo');

  globalThis.ONE_REACT_BACKUP_PANEL = Object.freeze({
    exportBackup() {
      backupExportButton.click();
      refreshBackupPanel();
    },
    async importFile(file) {
      await importBackup(file);
      refreshBackupPanel();
    },
    undoRestore() {
      backupUndoButton.click();
      refreshBackupPanel();
    },
  });

  refreshRecoveryAvailability();
  refreshBackupPanel({ force: true });
}
