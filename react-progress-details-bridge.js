if (document.documentElement.dataset.reactProgressDetails === '1') {
  const legacyDailyGoalProgress = document.querySelector('.daily-goal-progress');

  function levelFromClassList(classList) {
    for (let level = 0; level <= 4; level += 1) {
      if (classList.contains(`level-${level}`)) return level;
    }
    return 0;
  }

  function progressDetailsSnapshot() {
    const history = [...historyGrid.querySelectorAll('.history-day[role="listitem"]')].map((item) => {
      const bar = item.querySelector('.history-bar');
      return {
        ariaLabel: item.getAttribute('aria-label') ?? '',
        current: item.getAttribute('aria-current') === 'date',
        level: bar ? levelFromClassList(bar.classList) : 0,
        count: item.querySelector('strong')?.textContent ?? '0',
        weekday: item.querySelector('.history-weekday')?.textContent ?? '',
      };
    });

    const activity = [...activityGrid.children].map((item) => ({
      ariaLabel: item.getAttribute('aria-label') ?? '',
      current: item.getAttribute('aria-current') === 'date',
      placeholder: item.classList.contains('is-placeholder'),
      level: levelFromClassList(item.classList),
    }));

    return {
      goalValue: dailyGoalInput.value,
      goalInvalid: dailyGoalInput.getAttribute('aria-invalid') === 'true',
      goalInputDisabled: dailyGoalInput.disabled,
      goalApplyDisabled: dailyGoalApplyButton.disabled,
      goalClearHidden: dailyGoalClearButton.hidden,
      goalStatus: dailyGoalStatus.textContent ?? '',
      goalProgressHidden: legacyDailyGoalProgress?.hidden ?? true,
      goalProgressMax: legacyDailyGoalProgress?.max ?? 1,
      goalProgressValue: legacyDailyGoalProgress?.value ?? 0,
      goalProgressAriaValueText: legacyDailyGoalProgress?.getAttribute('aria-valuetext') ?? '',
      history,
      activity,
      activitySummary: activitySummary.textContent ?? '直近30日: 0回 · 0日活動',
    };
  }

  let lastSnapshot = '';

  function publishProgressDetailsState(force = false) {
    const snapshot = progressDetailsSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (!force && serialized === lastSnapshot) return;
    lastSnapshot = serialized;

    window.dispatchEvent(new CustomEvent('one:progress-details-state', {
      detail: snapshot,
    }));
  }

  const observer = new MutationObserver(() => publishProgressDetailsState());
  for (const element of [
    dailyGoalInput,
    dailyGoalApplyButton,
    dailyGoalClearButton,
    dailyGoalStatus,
    legacyDailyGoalProgress,
    historyGrid,
    activityGrid,
    activitySummary,
  ]) {
    if (!element) continue;
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  globalThis.ONE_REACT_PROGRESS_DETAILS = Object.freeze({
    snapshot: progressDetailsSnapshot,
    setGoalValue(value) {
      dailyGoalInput.value = String(value ?? '');
      dailyGoalInput.dispatchEvent(new Event('input', { bubbles: true }));
      publishProgressDetailsState(true);
    },
    applyGoal() {
      dailyGoalApplyButton.click();
      publishProgressDetailsState(true);
    },
    clearGoal() {
      dailyGoalClearButton.click();
      publishProgressDetailsState(true);
    },
  });

  function refreshAfterLegacyHandlers() {
    window.setTimeout(() => publishProgressDetailsState(true), 0);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === DAILY_GOAL_STORAGE_KEY || event.key === STORAGE_KEYS.history) {
      refreshAfterLegacyHandlers();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAfterLegacyHandlers();
  });
  window.addEventListener('pageshow', refreshAfterLegacyHandlers);

  publishProgressDetailsState(true);
}
