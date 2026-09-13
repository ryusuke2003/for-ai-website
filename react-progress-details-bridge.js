if (document.documentElement.dataset.reactProgressDetails === '1') {
  function refreshProgressDetailsState() {
    globalThis.ONE_REACT_REMAINING_STATE?.refreshProgressDetails?.();
  }

  globalThis.ONE_REACT_PROGRESS_DETAILS = Object.freeze({
    setGoalValue(value) {
      dailyGoalInput.value = String(value ?? '');
      dailyGoalInput.dispatchEvent(new Event('input', { bubbles: true }));
      refreshProgressDetailsState();
    },
    applyGoal() {
      dailyGoalApplyButton.click();
      refreshProgressDetailsState();
    },
    clearGoal() {
      dailyGoalClearButton.click();
      refreshProgressDetailsState();
    },
  });
}
