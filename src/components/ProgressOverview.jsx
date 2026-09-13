import { useEffect, useState } from 'react';

const DEFAULT_STATE = {
  doneLabel: 'タイマー完了後に記録できます',
  doneDisabled: true,
  discardHidden: true,
  todayCount: '0',
  todayAriaLabel: '',
  weekCount: '0',
  streakCount: '0',
  streakAriaLabel: '0日',
  doneCount: '0',
  streakStatus: '今日1回から連続記録を始められます。',
};

function bridge() {
  return globalThis.ONE_REACT_PROGRESS_OVERVIEW;
}

function readBridgeState() {
  return bridge()?.snapshot?.() ?? DEFAULT_STATE;
}

export function ProgressOverview() {
  const [state, setState] = useState(readBridgeState);

  useEffect(() => {
    function handleState(event) {
      setState(event.detail ?? readBridgeState());
    }

    window.addEventListener('one:progress-overview-state', handleState);
    setState(readBridgeState());

    return () => {
      window.removeEventListener('one:progress-overview-state', handleState);
    };
  }, []);

  return (
    <>
      <div className="controls">
        <button
          className="done-button"
          id="done-button"
          type="button"
          aria-describedby="done-hint"
          disabled={state.doneDisabled}
          onClick={() => bridge()?.record?.()}
        >
          {state.doneLabel}
        </button>
        <button
          className="secondary"
          id="discard-button"
          type="button"
          aria-describedby="done-hint"
          hidden={state.discardHidden}
          onClick={() => bridge()?.discard?.()}
        >
          記録せず破棄する
        </button>
      </div>
      <p className="hint" id="done-hint">
        タイマーが0:00になった集中だけ、1回だけ記録できます。完了後は「記録する」か「記録せず破棄する」を選ぶまで次のタイマー操作をロックします。日付をまたいでも完了した日の回数に入ります。
      </p>

      <div className="progress-summary" aria-live="polite">
        <div className="progress-stat">
          <strong id="today-count" aria-label={state.todayAriaLabel || undefined}>{state.todayCount}</strong>
          <span>今日</span>
        </div>
        <div className="progress-stat">
          <strong id="week-count">{state.weekCount}</strong>
          <span>今週</span>
        </div>
        <div className="progress-stat">
          <strong id="streak-count" aria-label={state.streakAriaLabel}>{state.streakCount}</strong>
          <span>連続日</span>
        </div>
        <div className="progress-stat">
          <strong id="done-count">{state.doneCount}</strong>
          <span>累計</span>
        </div>
      </div>
      <p className="hint" id="streak-status">{state.streakStatus}</p>
    </>
  );
}
