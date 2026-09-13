if (document.documentElement.dataset.reactTimerControls === '1') {
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

  forwardDetachedFocus(startButton, 'start');
  forwardDetachedFocus(focusModeButton, 'focus');

  globalThis.ONE_REACT_TIMER_CONTROLS = Object.freeze({
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
}
