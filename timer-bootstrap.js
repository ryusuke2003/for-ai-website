(() => {
  const STORAGE_KEY = 'one.timer.v1';
  const MAX_BYTES = 10_000;
  const MIN_MINUTES = 1;
  const MAX_MINUTES = 180;
  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isValidDateKey(key) {
    if (typeof key !== 'string' || !DATE_KEY_PATTERN.test(key)) return false;
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
  }

  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const { selectedMinutes, remainingSeconds, running, endAt } = value;
    if (!Number.isInteger(selectedMinutes) || selectedMinutes < MIN_MINUTES || selectedMinutes > MAX_MINUTES) {
      return null;
    }

    const fullDuration = selectedMinutes * 60;
    if (!Number.isInteger(remainingSeconds) || remainingSeconds < 0 || remainingSeconds > fullDuration) {
      return null;
    }
    if (typeof running !== 'boolean') return null;

    const hasCompletionReady = hasOwn(value, 'completionReady');
    const hasCompletionDate = hasOwn(value, 'completionDate');
    if (hasCompletionReady && typeof value.completionReady !== 'boolean') return null;
    if (
      hasCompletionDate
      && value.completionDate !== null
      && !isValidDateKey(value.completionDate)
    ) {
      return null;
    }

    const completionReady = hasCompletionReady ? value.completionReady : undefined;
    const completionDate = hasCompletionDate ? value.completionDate : undefined;

    if (running) {
      if (!Number.isSafeInteger(endAt) || endAt <= 0 || remainingSeconds <= 0 || completionReady === true) {
        return null;
      }
    } else if (endAt !== null && endAt !== undefined) {
      return null;
    }

    if (completionReady === true && remainingSeconds !== 0) return null;
    if (completionReady === false && completionDate !== null && completionDate !== undefined) return null;

    return {
      selectedMinutes,
      remainingSeconds,
      running,
      endAt: running ? endAt : null,
      ...(hasCompletionReady ? { completionReady } : {}),
      ...(hasCompletionDate ? { completionDate } : {}),
    };
  }

  function parse(raw) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_BYTES) return null;

    try {
      return normalize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  globalThis.ONE_TIMER_STATE_GUARD = Object.freeze({
    storageKey: STORAGE_KEY,
    maxBytes: MAX_BYTES,
    minMinutes: MIN_MINUTES,
    maxMinutes: MAX_MINUTES,
    normalize,
    parse,
  });
})();

function readBootstrappedTimerMinutes() {
  if (typeof localStorage === 'undefined') return null;

  try {
    const guard = globalThis.ONE_TIMER_STATE_GUARD;
    const raw = localStorage.getItem(guard.storageKey);
    return guard.parse(raw)?.selectedMinutes ?? null;
  } catch {
    return null;
  }
}

if (typeof document !== 'undefined') {
  const bootstrappedCustomMinutes = readBootstrappedTimerMinutes() ?? 25;
  const bootstrappedCustomPreset = document.querySelector('#custom-preset');
  const bootstrappedCustomInput = document.querySelector('#custom-minutes');

  if (bootstrappedCustomPreset) {
    bootstrappedCustomPreset.dataset.minutes = String(bootstrappedCustomMinutes);
  }
  if (bootstrappedCustomInput) {
    bootstrappedCustomInput.value = String(bootstrappedCustomMinutes);
  }
}
