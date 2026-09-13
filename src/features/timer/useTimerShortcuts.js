import { useEffect } from 'react';
import { timerActions } from './timerStore.js';

const INTERACTIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
].join(', ');

function isInteractiveShortcutTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function isImeComposition(event) {
  return event.isComposing || event.key === 'Process';
}

function hasUnsupportedShortcutModifier(event) {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
}

function focusTimerControl(control) {
  window.dispatchEvent(new CustomEvent('one:timer-controls-focus', {
    detail: { control },
  }));
}

export function useTimerShortcuts(focusModeActive, toggleFocusMode) {
  useEffect(() => {
    function handleKeyDown(event) {
      // Escape historically exits focus mode even when focus is inside a control.
      if (event.key === 'Escape' && focusModeActive) {
        toggleFocusMode();
        focusTimerControl('focus');
        return;
      }

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
        timerActions.toggle();
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleFocusMode();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusModeActive, toggleFocusMode]);
}
