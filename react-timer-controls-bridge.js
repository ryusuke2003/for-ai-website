if (document.documentElement.dataset.reactTimerControls === '1') {
  function timerControlsSnapshot() {
    return {
      startLabel: startButton.textContent ?? 'スタート',
      startPressed: startButton.getAttribute('aria-pressed') === 'true',
      startDisabled: startButton.disabled,
      resetDisabled: resetButton.disabled,
      focusLabel: focusModeButton.textContent ?? '集中表示',
      focusPressed: focusModeButton.getAttribute('aria-pressed') === 'true',
      focusAriaLabel: focusModeButton.getAttribute('aria-label') ?? '集中表示に切り替える',
    };
  }

  function publishTimerControlsState() {
    window.dispatchEvent(new CustomEvent('one:timer-controls-state', {
      detail: timerControlsSnapshot(),
    }));
  }

  function forwardDetachedFocus(button, control) {
    const nativeFocus = button.focus.bind(button);
    button.focus = (options) => {
      if (button.isConnected) {
        nativeFocus(options);
        return;
      }

      window.dispatchEvent(new CustomEvent('one:timer-controls-focus', {
        detail: { control },
      }));
    };
  }

  const observer = new MutationObserver(publishTimerControlsState);
  for (const button of [startButton, resetButton, focusModeButton]) {
    observer.observe(button, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['disabled', 'aria-pressed', 'aria-label'],
    });
  }

  forwardDetachedFocus(startButton, 'start');
  forwardDetachedFocus(focusModeButton, 'focus');

  globalThis.ONE_REACT_TIMER_CONTROLS = Object.freeze({
    snapshot: timerControlsSnapshot,
    start() {
      startButton.click();
    },
    reset() {
      resetButton.click();
    },
    toggleFocus() {
      focusModeButton.click();
    },
  });

  publishTimerControlsState();
}
