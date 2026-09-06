function isInteractiveShortcutTarget(target) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, button, [contenteditable="true"]'));
}

function hasUnsupportedShortcutModifier(event) {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
}

taskInput.addEventListener('keydown', (event) => {
  const commandEnter = event.key === 'Enter'
    && (event.metaKey || event.ctrlKey)
    && !event.altKey
    && !event.shiftKey;

  if (event.defaultPrevented || event.isComposing || event.repeat || !commandEnter) return;

  event.preventDefault();
  startButton.click();
});

document.addEventListener('keydown', (event) => {
  if (
    event.defaultPrevented
    || event.isComposing
    || event.repeat
    || hasUnsupportedShortcutModifier(event)
    || isInteractiveShortcutTarget(event.target)
  ) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    startButton.click();
    return;
  }

  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    focusModeButton.click();
  }
});
