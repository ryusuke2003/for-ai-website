import { useEffect, useState } from 'react';

const DEFAULT_STATE = {
  timeText: '25:00',
  timeAriaLabel: '残り時間 25:00',
  status: '準備できたらスタート。',
  progressMax: 1500,
  progressValue: 0,
  progressAriaValueText: '0%',
  endTimeHidden: true,
  endTimeText: '',
  endTimeDateTime: '',
};

function readBridgeState() {
  return globalThis.ONE_REACT_TIMER_DISPLAY?.snapshot?.() ?? DEFAULT_STATE;
}

export function TimerDisplay() {
  const [state, setState] = useState(readBridgeState);

  useEffect(() => {
    function handleState(event) {
      setState(event.detail ?? readBridgeState());
    }

    window.addEventListener('one:timer-display-state', handleState);
    setState(readBridgeState());

    return () => {
      window.removeEventListener('one:timer-display-state', handleState);
    };
  }, []);

  return (
    <>
      <div
        className="timer"
        id="timer"
        role="timer"
        aria-label={state.timeAriaLabel}
      >
        {state.timeText}
      </div>
      <progress
        className="timer-progress"
        id="timer-progress"
        max={state.progressMax}
        value={state.progressValue}
        aria-label="集中時間の進捗"
        aria-valuetext={state.progressAriaValueText}
      />
      <p
        className="timer-status"
        id="timer-status"
        role="status"
        aria-live="polite"
      >
        {state.status}
      </p>
      <p
        className="timer-status timer-end-time"
        id="timer-end-time"
        hidden={state.endTimeHidden}
      >
        終了予定{' '}
        <time
          id="timer-end-at"
          dateTime={state.endTimeDateTime || undefined}
        >
          {state.endTimeText}
        </time>
      </p>
    </>
  );
}
