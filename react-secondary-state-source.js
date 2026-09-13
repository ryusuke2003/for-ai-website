if (
  document.documentElement.dataset.reactTimerSettings === '1'
  || document.documentElement.dataset.reactProgressOverview === '1'
) {
  let settingsSnapshot = null;
  let settingsSerialized = '';
  let progressSnapshot = null;
  let progressSerialized = '';
  let settingsDirty = false;
  let progressDirty = false;
  let publishQueued = false;

  function toggleSnapshot(button, status) {
    return {
      label: button.textContent ?? '',
      pressed: button.getAttribute('aria-pressed') === 'true',
      disabled: button.disabled,
      status: status.textContent ?? '',
    };
  }

  function buildTimerSettingsSnapshot() {
    const sound = toggleSnapshot(completionSoundToggle, completionSoundStatus);
    const notification = toggleSnapshot(completionNotificationToggle, completionNotificationStatus);
    const wakeLock = toggleSnapshot(wakeLockToggle, wakeLockStatus);

    return {
      presets: standardPresetButtons.map((button) => ({
        minutes: Number.parseInt(button.dataset.minutes, 10),
        label: button.textContent ?? '',
        active: button.classList.contains('active'),
        pressed: button.getAttribute('aria-pressed') === 'true',
        disabled: button.disabled,
      })),
      customValue: customMinutesInput.value,
      customInvalid: customMinutesInput.getAttribute('aria-invalid') === 'true',
      customDisabled: customMinutesInput.disabled,
      customApplyDisabled: customMinutesApplyButton.disabled,
      customStatus: customMinutesStatus.textContent ?? '',
      soundLabel: sound.label,
      soundPressed: sound.pressed,
      soundDisabled: sound.disabled,
      soundStatus: sound.status,
      notificationLabel: notification.label,
      notificationPressed: notification.pressed,
      notificationDisabled: notification.disabled,
      notificationStatus: notification.status,
      wakeLockLabel: wakeLock.label,
      wakeLockPressed: wakeLock.pressed,
      wakeLockDisabled: wakeLock.disabled,
      wakeLockStatus: wakeLock.status,
    };
  }

  function buildProgressOverviewSnapshot() {
    return {
      doneLabel: doneButton.textContent ?? 'タイマー完了後に記録できます',
      doneDisabled: doneButton.disabled,
      discardHidden: discardButton.hidden,
      todayCount: todayCount.textContent ?? '0',
      todayAriaLabel: todayCount.getAttribute('aria-label') ?? '',
      weekCount: weekCount.textContent ?? '0',
      streakCount: streakCount.textContent ?? '0',
      streakAriaLabel: streakCount.getAttribute('aria-label') ?? '0日',
      doneCount: doneCount.textContent ?? '0',
      streakStatus: streakStatus.textContent ?? '',
    };
  }

  function publishPendingState() {
    publishQueued = false;

    if (settingsDirty) {
      settingsDirty = false;
      window.dispatchEvent(new CustomEvent('one:timer-settings-state', {
        detail: settingsSnapshot,
      }));
    }

    if (progressDirty) {
      progressDirty = false;
      window.dispatchEvent(new CustomEvent('one:progress-overview-state', {
        detail: progressSnapshot,
      }));
    }
  }

  function queuePublish() {
    if (publishQueued) return;
    publishQueued = true;
    queueMicrotask(publishPendingState);
  }

  function refreshSettings({ force = false } = {}) {
    const next = buildTimerSettingsSnapshot();
    const serialized = JSON.stringify(next);
    if (!force && serialized === settingsSerialized) return;

    settingsSerialized = serialized;
    settingsSnapshot = Object.freeze(next);
    settingsDirty = true;
    queuePublish();
  }

  function refreshProgress({ force = false } = {}) {
    const next = buildProgressOverviewSnapshot();
    const serialized = JSON.stringify(next);
    if (!force && serialized === progressSerialized) return;

    progressSerialized = serialized;
    progressSnapshot = Object.freeze(next);
    progressDirty = true;
    queuePublish();
  }

  function refreshBoth(options) {
    refreshSettings(options);
    refreshProgress(options);
  }

  function wrapStateMutation(name, { settings = false, progress = false } = {}) {
    const original = globalThis[name];
    if (typeof original !== 'function') return;

    globalThis[name] = function reactStateAwareMutation(...args) {
      const result = original.apply(this, args);
      const refresh = () => {
        if (settings) refreshSettings();
        if (progress) refreshProgress();
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
    'syncCustomTimerPresentation',
    'syncCustomTimerLock',
    'setCustomTimerStatus',
    'syncCompletionSoundUi',
    'syncCompletionNotificationUi',
    'syncWakeLockUi',
  ]) {
    wrapStateMutation(functionName, { settings: true });
  }

  for (const functionName of [
    'renderHistory',
    'renderProgressInsights',
    'syncProgressFromStorage',
    'refreshProgressFromStorage',
    'refreshGuardProgressFromStorage',
  ]) {
    wrapStateMutation(functionName, { progress: true });
  }

  wrapStateMutation('setRecordAvailability', { settings: true, progress: true });

  customMinutesInput.addEventListener('input', () => refreshSettings());

  window.addEventListener('storage', () => refreshBoth());
  window.addEventListener('pageshow', () => refreshBoth());
  window.addEventListener('one:idle-timer-sync', () => refreshSettings());
  window.addEventListener('one:storage-error', () => refreshBoth());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshBoth();
  });

  globalThis.ONE_REACT_TIMER_SETTINGS_STATE = Object.freeze({
    snapshot() {
      return settingsSnapshot;
    },
  });

  globalThis.ONE_REACT_PROGRESS_OVERVIEW_STATE = Object.freeze({
    snapshot() {
      return progressSnapshot;
    },
  });

  globalThis.ONE_REACT_SECONDARY_STATE = Object.freeze({
    refreshSettings,
    refreshProgress,
    refreshBoth,
  });

  refreshBoth({ force: true });
}
