import { useEffect, useRef, useState } from 'react';

const DEFAULT_STATE = {
  startLabel: 'スタート',
  startPressed: false,
  startDisabled: false,
  resetDisabled: false,
  focusLabel: '集中表示',
  focusPressed: false,
  focusAriaLabel: '集中表示に切り替える',
};

function readBridgeState() {
  return globalThis.ONE_REACT_TIMER_CONTROLS?.snapshot?.() ?? DEFAULT_STATE;
}

function invokeBridge(action) {
  globalThis.ONE_REACT_TIMER_CONTROLS?.[action]?.();
}

export function TimerControls() {
  const [state, setState] = useState(readBridgeState);
  const startRef = useRef(null);
  const focusRef = useRef(null);

  useEffect(() => {
    function handleState(event) {
      setState(event.detail ?? readBridgeState());
    }

    function handleFocus(event) {
      if (event.detail?.control === 'start') startRef.current?.focus();
      if (event.detail?.control === 'focus') focusRef.current?.focus();
    }

    window.addEventListener('one:timer-controls-state', handleState);
    window.addEventListener('one:timer-controls-focus', handleFocus);
    setState(readBridgeState());

    return () => {
      window.removeEventListener('one:timer-controls-state', handleState);
      window.removeEventListener('one:timer-controls-focus', handleFocus);
    };
  }, []);

  return (
    <>
      <button
        className="primary"
        id="start-button"
        type="button"
        aria-keyshortcuts="Space"
        aria-pressed={state.startPressed}
        disabled={state.startDisabled}
        ref={startRef}
        onClick={() => invokeBridge('start')}
      >
        {state.startLabel}
      </button>
      <button
        className="secondary"
        id="reset-button"
        type="button"
        disabled={state.resetDisabled}
        onClick={() => invokeBridge('reset')}
      >
        リセット
      </button>
      <button
        className="secondary"
        id="focus-mode-button"
        type="button"
        aria-pressed={state.focusPressed}
        aria-keyshortcuts="F Escape"
        aria-label={state.focusAriaLabel}
        ref={focusRef}
        onClick={() => invokeBridge('toggleFocus')}
      >
        {state.focusLabel}
      </button>
    </>
  );
}
