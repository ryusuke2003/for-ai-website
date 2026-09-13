// Temporary compatibility layer for progress actions/state.
if (document.documentElement.dataset.reactProgressOverview === '1') {
  let progressSnapshot = null;
  let progressSerialized = '';
  let publishQueued = false;

  function buildProgressOverviewSnapshot() {
    const timerState = globalThis.ONE_TIMER_RUNTIME?.snapshot?.() ?? null;
    const completionReady = timerState?.completionReady === true;
    return {
      doneLabel: completionReady
        ? 'この集中を記録する ✓'
        : 'タイマー完了後に記録できます',
      doneDisabled: !completionReady,
      discardHidden: !completionReady,
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
  ]) {
    wrapProgressMutation(functionName);
  }

  window.addEventListener('storage', () => refreshProgress());
  window.addEventListener('pageshow', () => refreshProgress());
  window.addEventListener('one:storage-error', () => refreshProgress());
  window.addEventListener('one:timer-state', () => refreshProgress());
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
      const recorded = globalThis.ONE_TAB_GUARD?.recordPendingCompletion?.() === true;
      refreshProgress();
      return recorded;
    },
    discard() {
      const discarded = globalThis.ONE_TAB_GUARD?.discardPendingCompletion?.() === true;
      refreshProgress();
      return discarded;
    },
    restoreBackupData(restored) {
      if (!Number.isSafeInteger(restored?.doneCount) || restored.doneCount < 0) return false;
      if (!restored.history || typeof restored.history !== 'object' || Array.isArray(restored.history)) return false;

      const normalized = normalizeHistory(restored.history);
      const inputEntries = Object.entries(restored.history);
      if (Object.keys(normalized).length !== inputEntries.length) return false;
      const historySum = Object.values(normalized).reduce((sum, count) => sum + count, 0);
      if (!Number.isSafeInteger(historySum) || restored.doneCount < historySum) return false;

      const countPersisted = safeWrite(STORAGE_KEYS.count, String(restored.doneCount));
      focusHistory = normalized;
      saveHistory();
      doneCount.textContent = String(restored.doneCount);
      renderHistory();
      refreshProgress();
      return countPersisted && !storageAccessFailed;
    },
  });

  refreshProgress({ force: true });
}
