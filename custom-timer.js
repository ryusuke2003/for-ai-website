const customMinutesInput = document.querySelector('#custom-minutes');
const customMinutesApplyButton = document.querySelector('#custom-minutes-apply');
const customMinutesStatus = document.querySelector('#custom-minutes-status');
const customPresetButton = document.querySelector('#custom-preset');
const standardPresetButtons = presetButtons.filter((button) => button !== customPresetButton);

function isAllowedCustomTimerMinutes(value) {
  return Number.isInteger(value)
    && value >= CUSTOM_TIMER_MINUTES_MIN
    && value <= CUSTOM_TIMER_MINUTES_MAX;
}

function parseCustomTimerMinutes() {
  const raw = customMinutesInput.value.trim();
  if (!/^\d{1,3}$/.test(raw)) return null;
  const minutes = Number(raw);
  return isAllowedCustomTimerMinutes(minutes) ? minutes : null;
}

function syncCustomTimerPresentation() {
  customMinutesInput.value = String(selectedMinutes);
  customMinutesInput.setAttribute('aria-invalid', 'false');

  standardPresetButtons.forEach((button) => {
    const active = Number.parseInt(button.dataset.minutes, 10) === selectedMinutes;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  customPresetButton.classList.remove('active');
  customPresetButton.setAttribute('aria-pressed', 'false');
}

function syncCustomTimerLock() {
  const locked = customPresetButton.disabled;
  customMinutesInput.disabled = locked;
  customMinutesApplyButton.disabled = locked;
}

function setCustomTimerStatus(message) {
  customMinutesStatus.textContent = message;
}

function applyCustomTimerMinutes() {
  if (customPresetButton.disabled) {
    setCustomTimerStatus('未記録の完了がある間はタイマー時間を変更できません。');
    return;
  }

  const minutes = parseCustomTimerMinutes();
  if (minutes === null) {
    customMinutesInput.setAttribute('aria-invalid', 'true');
    setCustomTimerStatus('1〜180分の整数を入力してください。');
    customMinutesInput.focus();
    return;
  }

  customPresetButton.dataset.minutes = String(minutes);
  selectPreset(customPresetButton);
  syncCustomTimerPresentation();
  setCustomTimerStatus(`${minutes}分に設定しました。`);
  startButton.focus();
}

// Backups may contain any supported custom duration, not only the three quick presets.
availablePresetMinutes = function availableTimerMinutesForBackup() {
  return Array.from(
    { length: CUSTOM_TIMER_MINUTES_MAX - CUSTOM_TIMER_MINUTES_MIN + 1 },
    (_, index) => index + CUSTOM_TIMER_MINUTES_MIN,
  );
};

const applyBackupWithoutCustomTimerSync = applyBackup;
applyBackup = function applyBackupWithCustomTimerSync(restored) {
  if (isAllowedCustomTimerMinutes(restored?.selectedMinutes)) {
    customPresetButton.dataset.minutes = String(restored.selectedMinutes);
  }

  applyBackupWithoutCustomTimerSync(restored);
  syncCustomTimerPresentation();
  syncCustomTimerLock();
};

standardPresetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    syncCustomTimerPresentation();
    setCustomTimerStatus('1〜180分の整数でも設定できます。');
  });
});

customMinutesApplyButton.addEventListener('click', applyCustomTimerMinutes);
customMinutesInput.addEventListener('input', () => {
  customMinutesInput.setAttribute('aria-invalid', 'false');
  setCustomTimerStatus('1〜180分の整数でも設定できます。');
});
customMinutesInput.addEventListener('keydown', (event) => {
  if (event.isComposing || event.key !== 'Enter') return;
  event.preventDefault();
  applyCustomTimerMinutes();
});

const customTimerLockObserver = new MutationObserver(syncCustomTimerLock);
customTimerLockObserver.observe(customPresetButton, { attributes: true, attributeFilter: ['disabled'] });

syncCustomTimerPresentation();
syncCustomTimerLock();
refreshRecoveryAvailability();
