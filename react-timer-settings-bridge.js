if (document.documentElement.dataset.reactTimerSettings === '1') {
  const legacyPresetButtons = standardPresetButtons;

  function refreshSettingsState() {
    globalThis.ONE_REACT_SECONDARY_STATE?.refreshSettings?.();
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

  forwardDetachedFocus(customMinutesInput, 'custom-minutes');

  globalThis.ONE_REACT_TIMER_SETTINGS = Object.freeze({
    selectPreset(minutes) {
      const target = legacyPresetButtons.find(
        (button) => Number.parseInt(button.dataset.minutes, 10) === minutes,
      );
      target?.click();
      refreshSettingsState();
    },
    setCustomValue(value) {
      customMinutesInput.value = String(value ?? '');
      customMinutesInput.dispatchEvent(new Event('input', { bubbles: true }));
      refreshSettingsState();
    },
    applyCustom() {
      customMinutesApplyButton.click();
      refreshSettingsState();
    },
    toggleSound() {
      completionSoundToggle.click();
      refreshSettingsState();
    },
    toggleNotification() {
      completionNotificationToggle.click();
      refreshSettingsState();
    },
    toggleWakeLock() {
      wakeLockToggle.click();
      refreshSettingsState();
    },
  });
}
