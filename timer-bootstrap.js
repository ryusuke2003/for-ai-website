const CUSTOM_TIMER_STORAGE_KEY = 'one.customMinutes.v1';
const CUSTOM_TIMER_MINUTES_MIN = 1;
const CUSTOM_TIMER_MINUTES_MAX = 180;

function isStoredCustomTimerMinutes(value) {
  return Number.isInteger(value)
    && value >= CUSTOM_TIMER_MINUTES_MIN
    && value <= CUSTOM_TIMER_MINUTES_MAX;
}

function readCustomTimerMinutes() {
  try {
    const raw = localStorage.getItem(CUSTOM_TIMER_STORAGE_KEY);
    if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
    const minutes = Number(raw);
    return isStoredCustomTimerMinutes(minutes) ? minutes : null;
  } catch {
    return null;
  }
}

const bootstrappedCustomMinutes = readCustomTimerMinutes() ?? 25;
const bootstrappedCustomPreset = document.querySelector('#custom-preset');
const bootstrappedCustomInput = document.querySelector('#custom-minutes');

if (bootstrappedCustomPreset) {
  bootstrappedCustomPreset.dataset.minutes = String(bootstrappedCustomMinutes);
}
if (bootstrappedCustomInput) {
  bootstrappedCustomInput.value = String(bootstrappedCustomMinutes);
}
