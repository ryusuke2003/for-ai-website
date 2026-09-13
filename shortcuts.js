function isInteractiveShortcutTarget(target) {
  return target instanceof Element
    && Boolean(target.closest(
      'input, textarea, select, button, a[href], summary, [contenteditable="true"], [role="button"], [role="link"]',
    ));
}

function isImeComposition(event) {
  return event.isComposing || event.key === 'Process';
}

function hasUnsupportedShortcutModifier(event) {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
}

document.addEventListener('keydown', (event) => {
  if (
    event.defaultPrevented
    || isImeComposition(event)
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
