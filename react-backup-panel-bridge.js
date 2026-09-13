function hasActiveDailyTaskContext() {
  const fullDuration = selectedMinutes * 60;
  return timerId !== null
    || completionReady
    || (remainingSeconds > 0 && remainingSeconds < fullDuration);
}

if (document.documentElement.dataset.reactBackupPanel === '1') {
  function backupPanelSnapshot() {
    return {
      importDisabled: backupImportButton.disabled,
      undoHidden: backupUndoButton.hidden,
      undoDisabled: backupUndoButton.disabled,
      backupStatus: backupStatus.textContent ?? '',
      resetButtonHidden: dataResetButton.hidden,
      resetConfirmHidden: dataResetConfirm.hidden,
      resetConfirmDisabled: dataResetConfirmButton.disabled,
      resetCancelDisabled: dataResetCancelButton.disabled,
      resetStatus: dataResetStatus.textContent ?? '',
    };
  }

  let lastSnapshot = '';

  function publishBackupPanelState({ force = false } = {}) {
    const snapshot = backupPanelSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (!force && serialized === lastSnapshot) return;
    lastSnapshot = serialized;

    window.dispatchEvent(new CustomEvent('one:backup-panel-state', {
      detail: snapshot,
    }));
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

  const observedElements = [
    backupImportButton,
    backupUndoButton,
    backupStatus,
    dataResetButton,
    dataResetConfirm,
    dataResetConfirmButton,
    dataResetCancelButton,
    dataResetStatus,
  ];

  const observer = new MutationObserver(() => publishBackupPanelState());
  for (const element of observedElements) {
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['disabled', 'hidden'],
    });
  }

  forwardDetachedFocus(backupExportButton, 'export');
  forwardDetachedFocus(backupUndoButton, 'undo');
  forwardDetachedFocus(dataResetButton, 'reset');
  forwardDetachedFocus(dataResetConfirmButton, 'reset-confirm');
  forwardDetachedFocus(dataResetCancelButton, 'reset-cancel');

  globalThis.ONE_REACT_BACKUP_PANEL = Object.freeze({
    snapshot: backupPanelSnapshot,
    exportBackup() {
      backupExportButton.click();
      publishBackupPanelState({ force: true });
    },
    async importFile(file) {
      await importBackup(file);
      publishBackupPanelState({ force: true });
    },
    undoRestore() {
      backupUndoButton.click();
      publishBackupPanelState({ force: true });
    },
    openReset() {
      dataResetButton.click();
      publishBackupPanelState({ force: true });
    },
    confirmReset() {
      dataResetConfirmButton.click();
      publishBackupPanelState({ force: true });
    },
    cancelReset() {
      dataResetCancelButton.click();
      publishBackupPanelState({ force: true });
    },
  });

  refreshRecoveryAvailability();
  publishBackupPanelState({ force: true });
}
