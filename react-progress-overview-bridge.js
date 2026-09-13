if (document.documentElement.dataset.reactProgressOverview === '1') {
  function refreshProgressState() {
    globalThis.ONE_REACT_SECONDARY_STATE?.refreshProgress?.();
  }

  globalThis.ONE_REACT_PROGRESS_OVERVIEW = Object.freeze({
    record() {
      doneButton.click();
      refreshProgressState();
    },
    discard() {
      discardButton.click();
      refreshProgressState();
    },
  });
}
