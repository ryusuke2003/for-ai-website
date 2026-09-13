// Temporary compatibility layer for progress read models and backup UI.
if (
  document.documentElement.dataset.reactProgressDetails === '1'
  || document.documentElement.dataset.reactBackupPanel === '1'
) {
  let progressDetailsSnapshot = null;
  let progressDetailsSerialized = '';
  let backupPanelSnapshot = null;
  let backupPanelSerialized = '';
  let progressDetailsDirty = false;
  let backupPanelDirty = false;
  let publishQueued = false;

  function levelFromClassList(classList) {
    for (let level = 0; level <= 4; level += 1) {
      if (classList.contains(`level-${level}`)) return level;
    }
    return 0;
  }

  function buildProgressDetailsSnapshot() {
    const history = [...historyGrid.querySelectorAll('.history-day[role="listitem"]')].map((item) => {
      const bar = item.querySelector('.history-bar');
      return {
        ariaLabel: item.getAttribute('aria-label') ?? '',
        current: item.getAttribute('aria-current') === 'date',
        level: bar ? levelFromClassList(bar.classList) : 0,
        count: item.querySelector('strong')?.textContent ?? '0',
        weekday: item.querySelector('.history-weekday')?.textContent ?? '',
      };
    });

    const activity = [...activityGrid.children].map((item) => ({
      ariaLabel: item.getAttribute('aria-label') ?? '',
      current: item.getAttribute('aria-current') === 'date',
      placeholder: item.classList.contains('is-placeholder'),
      level: levelFromClassList(item.classList),
    }));

    return {
      history,
      activity,
      activitySummary: activitySummary.textContent ?? '直近30日: 0回 · 0日活動',
    };
  }

  function buildBackupPanelSnapshot() {
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

  function publishPendingState() {
    publishQueued = false;

    if (progressDetailsDirty) {
      progressDetailsDirty = false;
      window.dispatchEvent(new CustomEvent('one:progress-details-state', {
        detail: progressDetailsSnapshot,
      }));
    }

    if (backupPanelDirty) {
      backupPanelDirty = false;
      window.dispatchEvent(new CustomEvent('one:backup-panel-state', {
        detail: backupPanelSnapshot,
      }));
    }
  }

  function queuePublish() {
    if (publishQueued) return;
    publishQueued = true;
    queueMicrotask(publishPendingState);
  }

  function refreshProgressDetails({ force = false } = {}) {
    const next = buildProgressDetailsSnapshot();
    const serialized = JSON.stringify(next);
    if (!force && serialized === progressDetailsSerialized) return;

    progressDetailsSerialized = serialized;
    progressDetailsSnapshot = Object.freeze(next);
    progressDetailsDirty = true;
    queuePublish();
  }

  function refreshBackupPanel({ force = false } = {}) {
    const next = buildBackupPanelSnapshot();
    const serialized = JSON.stringify(next);
    if (!force && serialized === backupPanelSerialized) return;

    backupPanelSerialized = serialized;
    backupPanelSnapshot = Object.freeze(next);
    backupPanelDirty = true;
    queuePublish();
  }

  function refreshAll(options) {
    refreshProgressDetails(options);
    refreshBackupPanel(options);
  }

  function wrapStateMutation(name, { progressDetails = false, backupPanel = false } = {}) {
    const original = globalThis[name];
    if (typeof original !== 'function') return;

    globalThis[name] = function reactRemainingStateAwareMutation(...args) {
      const result = original.apply(this, args);
      const refresh = () => {
        if (progressDetails) refreshProgressDetails();
        if (backupPanel) refreshBackupPanel();
      };

      if (result && typeof result.finally === 'function') {
        void result.finally(refresh);
      } else {
        refresh();
      }
      return result;
    };
  }

  for (const functionName of [
    'renderHistory',
    'renderActivityMap',
    'renderProgressInsights',
    'markCurrentHistoryDay',
  ]) {
    wrapStateMutation(functionName, { progressDetails: true });
  }

  for (const functionName of [
    'setBackupStatus',
    'refreshBackupControlAvailability',
    'refreshRecoveryAvailability',
    'setDataResetStatus',
    'setDataResetConfirmationVisible',
  ]) {
    wrapStateMutation(functionName, { backupPanel: true });
  }

  window.addEventListener('one:progress-overview-state', () => {
    refreshProgressDetails();
    refreshBackupPanel();
  });
  window.addEventListener('one:timer-state', () => refreshBackupPanel());
  window.addEventListener('storage', () => refreshAll());
  window.addEventListener('pageshow', () => refreshAll());
  window.addEventListener('one:storage-error', () => refreshBackupPanel());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAll();
  });

  globalThis.ONE_REACT_PROGRESS_DETAILS_STATE = Object.freeze({
    snapshot() {
      return progressDetailsSnapshot;
    },
  });

  globalThis.ONE_REACT_BACKUP_PANEL_STATE = Object.freeze({
    snapshot() {
      return backupPanelSnapshot;
    },
  });

  globalThis.ONE_REACT_REMAINING_STATE = Object.freeze({
    refreshProgressDetails,
    refreshBackupPanel,
    refreshAll,
  });

  refreshAll({ force: true });
}

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
