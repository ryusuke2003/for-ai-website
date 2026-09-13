if (document.documentElement.dataset.reactBackupPanel === '1') {
  function refreshBackupPanelState() {
    globalThis.ONE_REACT_REMAINING_STATE?.refreshBackupPanel?.();
  }

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
  forwardDetachedFocus(dataResetButton, 'reset');
  forwardDetachedFocus(dataResetConfirmButton, 'reset-confirm');
  forwardDetachedFocus(dataResetCancelButton, 'reset-cancel');

  globalThis.ONE_REACT_BACKUP_PANEL = Object.freeze({
    exportBackup() {
      backupExportButton.click();
      refreshBackupPanelState();
    },
    async importFile(file) {
      await importBackup(file);
      refreshBackupPanelState();
    },
    undoRestore() {
      backupUndoButton.click();
      refreshBackupPanelState();
    },
    openReset() {
      dataResetButton.click();
      refreshBackupPanelState();
    },
    confirmReset() {
      dataResetConfirmButton.click();
      refreshBackupPanelState();
    },
    cancelReset() {
      dataResetCancelButton.click();
      refreshBackupPanelState();
    },
  });

  refreshRecoveryAvailability();
  refreshBackupPanelState();
}
