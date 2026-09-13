if (document.documentElement.dataset.reactTimerDisplay === '1') {
  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function timerDisplaySnapshot() {
    const progressMax = Math.max(1, finiteNumber(timerProgress.max, selectedMinutes * 60));
    const progressValue = Math.min(
      progressMax,
      Math.max(0, finiteNumber(timerProgress.value, 0)),
    );

    return {
      timeText: timer.textContent ?? '25:00',
      timeAriaLabel: timer.getAttribute('aria-label') ?? '残り時間',
      status: timerStatus.textContent ?? '',
      progressMax,
      progressValue,
      progressAriaValueText: timerProgress.getAttribute('aria-valuetext') ?? '0%',
      endTimeHidden: timerEndTime.hidden,
      endTimeText: timerEndAt.textContent ?? '',
      endTimeDateTime: timerEndAt.getAttribute('datetime') ?? '',
    };
  }

  function publishTimerDisplayState() {
    window.dispatchEvent(new CustomEvent('one:timer-display-state', {
      detail: timerDisplaySnapshot(),
    }));
  }

  const observer = new MutationObserver(publishTimerDisplayState);
  for (const element of [timer, timerStatus, timerProgress, timerEndTime, timerEndAt]) {
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        'aria-label',
        'aria-valuetext',
        'max',
        'value',
        'hidden',
        'datetime',
      ],
    });
  }

  const renderTimerWithoutReactDisplaySync = renderTimer;
  renderTimer = function renderTimerWithReactDisplaySync(...args) {
    const result = renderTimerWithoutReactDisplaySync(...args);
    publishTimerDisplayState();
    return result;
  };

  globalThis.ONE_REACT_TIMER_DISPLAY = Object.freeze({
    snapshot: timerDisplaySnapshot,
  });

  publishTimerDisplayState();
}
