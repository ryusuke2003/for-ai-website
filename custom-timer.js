const customMinutesInput = document.querySelector('#custom-minutes');
const customMinutesApplyButton = document.querySelector('#custom-minutes-apply');
const customMinutesStatus = document.querySelector('#custom-minutes-status');
const customPresetButton = document.querySelector('#custom-preset');
const timerProgress = document.querySelector('#timer-progress');
const timerEndTime = document.querySelector('#timer-end-time');
const timerEndAt = document.querySelector('#timer-end-at');
const standardPresetButtons = presetButtons.filter((button) => button !== customPresetButton);

const DEFAULT_DOCUMENT_TITLE = 'ONE — 今日やる一つだけ';
const timerEndTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

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

function renderTimerProgress() {
  const fullDuration = Math.max(1, selectedMinutes * 60);
  const elapsedSeconds = Math.min(fullDuration, Math.max(0, fullDuration - remainingSeconds));
  const percentage = Math.round((elapsedSeconds / fullDuration) * 100);

  timerProgress.max = fullDuration;
  timerProgress.value = elapsedSeconds;
  timerProgress.setAttribute('aria-valuetext', `${percentage}%`);
}

function hideTimerEndTime() {
  timerEndTime.hidden = true;
  timerEndAt.textContent = '';
  timerEndAt.removeAttribute('datetime');
}

function renderTimerEndTime() {
  if (timerId === null || !Number.isFinite(endAt)) {
    hideTimerEndTime();
    return;
  }

  const endDate = new Date(endAt);
  if (Number.isNaN(endDate.getTime())) {
    hideTimerEndTime();
    return;
  }

  const formattedTime = timerEndTimeFormatter.format(endDate);
  timerEndAt.textContent = dateKey(endDate) === dateKey()
    ? formattedTime
    : `${endDate.getMonth() + 1}/${endDate.getDate()} ${formattedTime}`;
  timerEndAt.setAttribute('datetime', endDate.toISOString());
  timerEndTime.hidden = false;
}

function renderTimerDocumentTitle() {
  const formatted = formatTime(remainingSeconds);
  const fullDuration = selectedMinutes * 60;
  const partiallyElapsed = remainingSeconds > 0 && remainingSeconds < fullDuration;

  if (completionReady) {
    document.title = '完了！ — ONE';
    return;
  }

  if (timerId !== null && endAt !== null) {
    document.title = `${formatted} — ONE`;
    return;
  }

  document.title = partiallyElapsed
    ? `${formatted} 一時停止 — ONE`
    : DEFAULT_DOCUMENT_TITLE;
}

const renderTimerWithoutProgress = renderTimer;
renderTimer = function renderTimerWithProgress() {
  renderTimerWithoutProgress();
  renderTimerProgress();
  renderTimerEndTime();
  renderTimerDocumentTitle();
};

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
  customPresetButton.click();
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

window.addEventListener('one:idle-timer-sync', (event) => {
  const minutes = event.detail?.selectedMinutes;
  if (!isAllowedCustomTimerMinutes(minutes)) return;

  customPresetButton.dataset.minutes = String(minutes);
  syncCustomTimerPresentation();
  syncCustomTimerLock();
  setCustomTimerStatus(`別のタブで${minutes}分に変更されました。`);
});

const customTimerLockObserver = new MutationObserver(syncCustomTimerLock);
customTimerLockObserver.observe(customPresetButton, { attributes: true, attributeFilter: ['disabled'] });

syncCustomTimerPresentation();
syncCustomTimerLock();
renderTimerProgress();
renderTimerEndTime();
renderTimerDocumentTitle();
refreshRecoveryAvailability();
