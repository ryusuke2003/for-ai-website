if (document.documentElement.dataset.reactProgressOverview === '1') {
  function progressOverviewSnapshot() {
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

  let lastSnapshot = '';

  function publishProgressOverviewState({ force = false } = {}) {
    const snapshot = progressOverviewSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (!force && serialized === lastSnapshot) return;
    lastSnapshot = serialized;

    window.dispatchEvent(new CustomEvent('one:progress-overview-state', {
      detail: snapshot,
    }));
  }

  const observer = new MutationObserver(() => publishProgressOverviewState());
  for (const element of [
    doneButton,
    discardButton,
    todayCount,
    weekCount,
    streakCount,
    doneCount,
    streakStatus,
  ]) {
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['disabled', 'hidden', 'aria-label'],
    });
  }

  globalThis.ONE_REACT_PROGRESS_OVERVIEW = Object.freeze({
    snapshot: progressOverviewSnapshot,
    record() {
      doneButton.click();
      publishProgressOverviewState();
    },
    discard() {
      discardButton.click();
      publishProgressOverviewState();
    },
  });

  publishProgressOverviewState({ force: true });
}
