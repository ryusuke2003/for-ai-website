if (document.documentElement.dataset.reactTimerSettings === '1') {
  const legacyPresetButtons = standardPresetButtons;

  function toggleSnapshot(button, status) {
    return {
      label: button.textContent ?? '',
      pressed: button.getAttribute('aria-pressed') === 'true',
      disabled: button.disabled,
      status: status.textContent ?? '',
    };
  }

  function timerSettingsSnapshot() {
    const sound = toggleSnapshot(completionSoundToggle, completionSoundStatus);
    const notification = toggleSnapshot(completionNotificationToggle, completionNotificationStatus);
    const wakeLock = toggleSnapshot(wakeLockToggle, wakeLockStatus);

    return {
      presets: legacyPresetButtons.map((button) => ({
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

  let lastSnapshot = '';

  function publishTimerSettingsState({ force = false } = {}) {
    const snapshot = timerSettingsSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (!force && serialized === lastSnapshot) return;
    lastSnapshot = serialized;

    window.dispatchEvent(new CustomEvent('one:timer-settings-state', {
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

      window.dispatchEvent(new CustomEvent('one:timer-settings-focus', {
        detail: { control },
      }));
    };
  }

  const observedElements = [
    ...legacyPresetButtons,
    customPresetButton,
    customMinutesInput,
    customMinutesApplyButton,
    customMinutesStatus,
    completionSoundToggle,
    completionSoundStatus,
    completionNotificationToggle,
    completionNotificationStatus,
    wakeLockToggle,
    wakeLockStatus,
  ];

  const observer = new MutationObserver(() => publishTimerSettingsState());
  for (const element of observedElements) {
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  forwardDetachedFocus(customMinutesInput, 'custom-minutes');

  globalThis.ONE_REACT_TIMER_SETTINGS = Object.freeze({
    snapshot: timerSettingsSnapshot,
    selectPreset(minutes) {
      const target = legacyPresetButtons.find(
        (button) => Number.parseInt(button.dataset.minutes, 10) === minutes,
      );
      target?.click();
      publishTimerSettingsState();
    },
    setCustomValue(value) {
      customMinutesInput.value = String(value ?? '');
      customMinutesInput.dispatchEvent(new Event('input', { bubbles: true }));
      publishTimerSettingsState({ force: true });
    },
    applyCustom() {
      customMinutesApplyButton.click();
      publishTimerSettingsState();
    },
    toggleSound() {
      completionSoundToggle.click();
      publishTimerSettingsState();
    },
    toggleNotification() {
      completionNotificationToggle.click();
      publishTimerSettingsState();
    },
    toggleWakeLock() {
      wakeLockToggle.click();
      publishTimerSettingsState();
    },
  });

  publishTimerSettingsState({ force: true });
}
