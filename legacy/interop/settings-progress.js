// Temporary compatibility layer for progress actions/state and custom-duration backup restore.
if (document.documentElement.dataset.reactProgressOverview === '1') {
  let progressSnapshot = null;
  let progressSerialized = '';
  let publishQueued = false;

  function buildProgressOverviewSnapshot() {
    return {
      doneLabel: doneButton.textContent ?? 'タイマー完了後に記録できます',
      doneDisabled: doneButton.disabled,
      discardHidden: discardButton.hidden,
      doneCount: doneCount.textContent ?? '0',
      history: Object.freeze({ ...normalizeHistory(focusHistory) }),
    };
  }

  function dispatchProgressState() {
    publishQueued = false;
    window.dispatchEvent(new CustomEvent('one:progress-overview-state', {
      detail: progressSnapshot,
    }));
  }

  function refreshProgress({ force = false } = {}) {
    const next = buildProgressOverviewSnapshot();
    const serialized = JSON.stringify(next);
    if (!force && serialized === progressSerialized) return;

    progressSerialized = serialized;
    progressSnapshot = Object.freeze(next);
    if (publishQueued) return;

    publishQueued = true;
    queueMicrotask(dispatchProgressState);
  }

  function wrapProgressMutation(name) {
    const original = globalThis[name];
    if (typeof original !== 'function') return;

    globalThis[name] = function reactProgressAwareMutation(...args) {
      const result = original.apply(this, args);
      const refresh = () => refreshProgress();
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
    'refreshGuardProgressFromStorage',
    'setRecordAvailability',
  ]) {
    wrapProgressMutation(functionName);
  }

  window.addEventListener('storage', () => refreshProgress());
  window.addEventListener('pageshow', () => refreshProgress());
  window.addEventListener('one:storage-error', () => refreshProgress());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshProgress();
  });

  globalThis.ONE_REACT_PROGRESS_OVERVIEW_STATE = Object.freeze({
    snapshot() {
      return progressSnapshot;
    },
  });

  globalThis.ONE_REACT_SECONDARY_STATE = Object.freeze({
    refreshProgress,
  });

  globalThis.ONE_REACT_PROGRESS_OVERVIEW = Object.freeze({
    record() {
      doneButton.click();
      refreshProgress();
    },
    discard() {
      discardButton.click();
      refreshProgress();
    },
  });

  refreshProgress({ force: true });
}

const customDurationPreset = document.querySelector('#custom-preset');
const customDurationGuard = globalThis.ONE_TIMER_STATE_GUARD;
if (customDurationPreset && customDurationGuard) {
  availablePresetMinutes = function availableCustomTimerMinutesForBackup() {
    return Array.from(
      { length: customDurationGuard.maxMinutes - customDurationGuard.minMinutes + 1 },
      (_, index) => index + customDurationGuard.minMinutes,
    );
  };

  const applyBackupWithoutCustomDurationSync = applyBackup;
  applyBackup = function applyBackupWithCustomDurationSync(restored) {
    if (
      Number.isInteger(restored?.selectedMinutes)
      && restored.selectedMinutes >= customDurationGuard.minMinutes
      && restored.selectedMinutes <= customDurationGuard.maxMinutes
    ) {
      customDurationPreset.dataset.minutes = String(restored.selectedMinutes);
    }
    applyBackupWithoutCustomDurationSync(restored);
  };

  refreshRecoveryAvailability();
}
