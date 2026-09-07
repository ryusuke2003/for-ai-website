const TIMER_STATE_STORAGE_KEY = 'one.timer.v1';

function readBootstrappedTimerMinutes() {
  try {
    const raw = localStorage.getItem(TIMER_STATE_STORAGE_KEY);
    return globalThis.ONE_TIMER_STATE_GUARD?.parse(raw)?.selectedMinutes ?? null;
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
