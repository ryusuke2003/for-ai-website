import { useEffect, useRef } from 'react';
import { timerActions } from './timerStore.js';
import { useTimerState } from './useTimerState.js';

const BASE_BUTTON_CLASS = 'min-h-12 rounded-full border border-[var(--one-control-border)] px-[22px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45';
const SECONDARY_BUTTON_CLASS = `${BASE_BUTTON_CLASS} bg-transparent text-inherit aria-pressed:bg-[var(--one-active-bg)] aria-pressed:text-[var(--one-active-fg)]`;

function startLabelFor(state) {
  if (state.running) return '一時停止';

  const fullDuration = Math.max(1, state.selectedMinutes * 60);
  if (state.remainingSeconds > 0 && state.remainingSeconds < fullDuration) return '再開';
  if (state.remainingSeconds === 0) return 'もう一度';
  return 'スタート';
}

export function TimerControls({ focusModeActive, onToggleFocusMode }) {
  const state = useTimerState();
  const startRef = useRef(null);
  const focusRef = useRef(null);

  useEffect(() => {
    function handleFocus(event) {
      if (event.detail?.control === 'start') startRef.current?.focus();
      if (event.detail?.control === 'focus') focusRef.current?.focus();
    }

    window.addEventListener('one:timer-controls-focus', handleFocus);
    return () => {
      window.removeEventListener('one:timer-controls-focus', handleFocus);
    };
  }, []);

  const focusLabel = focusModeActive ? '通常表示' : '集中表示';
  const focusAriaLabel = focusModeActive ? '通常表示に戻る' : '集中表示に切り替える';

  return (
    <>
      <button
        className={`${BASE_BUTTON_CLASS} bg-[var(--one-primary-bg)] text-[var(--one-primary-fg)]`}
        id="start-button"
        type="button"
        aria-keyshortcuts="Space"
        aria-pressed={state.running}
        disabled={state.completionReady}
        ref={startRef}
        onClick={() => timerActions.toggle()}
      >
        {startLabelFor(state)}
      </button>
      <button className={SECONDARY_BUTTON_CLASS} id="reset-button" type="button" disabled={state.completionReady} onClick={() => timerActions.reset()}>
        リセット
      </button>
      <button
        className={SECONDARY_BUTTON_CLASS}
        id="focus-mode-button"
        type="button"
        aria-pressed={focusModeActive}
        aria-keyshortcuts="F Escape"
        aria-label={focusAriaLabel}
        ref={focusRef}
        onClick={onToggleFocusMode}
      >
        {focusLabel}
      </button>
    </>
  );
}
