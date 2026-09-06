const CUSTOM_TIMER_MINUTES_MIN = 1;
const CUSTOM_TIMER_MINUTES_MAX = 180;
const TIMER_STATE_STORAGE_KEY = 'one.timer.v1';
const MAX_BOOTSTRAP_TIMER_STATE_BYTES = 10_000;

function isBootstrappableTimerMinutes(value) {
  return Number.isInteger(value)
    && value >= CUSTOM_TIMER_MINUTES_MIN
    && value <= CUSTOM_TIMER_MINUTES_MAX;
}

function readBootstrappedTimerMinutes() {
  try {
    const raw = localStorage.getItem(TIMER_STATE_STORAGE_KEY);
    if (!raw || raw.length > MAX_BOOTSTRAP_TIMER_STATE_BYTES) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
    return isBootstrappableTimerMinutes(state.selectedMinutes) ? state.selectedMinutes : null;
  } catch {
    return null;
  }
}

const bootstrappedCustomMinutes = readBootstrappedTimerMinutes() ?? 25;
const bootstrappedCustomPreset = document.querySelector('#custom-preset');
const bootstrappedCustomInput = document.querySelector('#custom-minutes');

if (bootstrappedCustomPreset) {
  bootstrappedCustomPreset.dataset.minutes = String(bootstrappedCustomMinutes);
}
if (bootstrappedCustomInput) {
  bootstrappedCustomInput.value = String(bootstrappedCustomMinutes);
}
