import { useEffect, useState } from 'react';

const DEFAULT_STATE = {
  goalValue: '',
  goalInvalid: false,
  goalInputDisabled: false,
  goalApplyDisabled: false,
  goalClearHidden: true,
  goalStatus: '今日の目標は未設定です。1〜12回で設定できます。',
  goalProgressHidden: true,
  goalProgressMax: 1,
  goalProgressValue: 0,
  goalProgressAriaValueText: '',
  history: [],
  activity: [],
  activitySummary: '直近30日: 0回 · 0日活動',
};

function readBridgeState() {
  return globalThis.ONE_REACT_PROGRESS_DETAILS?.snapshot?.() ?? DEFAULT_STATE;
}

function setGoalValue(value) {
  globalThis.ONE_REACT_PROGRESS_DETAILS?.setGoalValue?.(value);
}

function applyGoal() {
  globalThis.ONE_REACT_PROGRESS_DETAILS?.applyGoal?.();
}

function clearGoal() {
  globalThis.ONE_REACT_PROGRESS_DETAILS?.clearGoal?.();
}

export function ProgressDetails() {
  const [state, setState] = useState(readBridgeState);

  useEffect(() => {
    function handleState(event) {
      setState(event.detail ?? readBridgeState());
    }

    window.addEventListener('one:progress-details-state', handleState);
    setState(readBridgeState());

    return () => {
      window.removeEventListener('one:progress-details-state', handleState);
    };
  }, []);

  return (
    <>
      <div className="presets" aria-describedby="daily-goal-status">
        <span className="custom-time">
          <label htmlFor="daily-goal-input">今日の目標</label>
          <input
            className="custom-minutes-input"
            id="daily-goal-input"
            type="number"
            min="1"
            max="12"
            step="1"
            inputMode="numeric"
            placeholder="3"
            value={state.goalValue}
            aria-describedby="daily-goal-status"
            aria-invalid={state.goalInvalid}
            disabled={state.goalInputDisabled}
            onChange={(event) => setGoalValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.isComposing || event.key !== 'Enter') return;
              event.preventDefault();
              applyGoal();
            }}
          />
          <span aria-hidden="true">回</span>
          <button
            id="daily-goal-apply"
            type="button"
            aria-describedby="daily-goal-status"
            disabled={state.goalApplyDisabled}
            onClick={applyGoal}
          >
            設定
          </button>
        </span>
        <button
          id="daily-goal-clear"
          type="button"
          aria-describedby="daily-goal-status"
          hidden={state.goalClearHidden}
          onClick={clearGoal}
        >
          目標を解除
        </button>
      </div>
      <p className="hint" id="daily-goal-status" role="status" aria-live="polite">
        {state.goalStatus}
      </p>
      <progress
        className="daily-goal-progress"
        max={state.goalProgressMax}
        value={state.goalProgressValue}
        hidden={state.goalProgressHidden}
        aria-label="今日の集中目標の進捗"
        aria-valuetext={state.goalProgressAriaValueText || undefined}
      />

      <div className="history" aria-labelledby="history-title">
        <div className="history-heading">
          <h3 id="history-title">直近7日</h3>
          <span>集中した回数</span>
        </div>
        <div className="history-grid" id="history-grid" role="list">
          {state.history.map((day, index) => (
            <div
              className="history-day"
              role="listitem"
              aria-label={day.ariaLabel}
              aria-current={day.current ? 'date' : undefined}
              key={`${day.ariaLabel}-${index}`}
            >
              <span className={`history-bar level-${day.level}`} aria-hidden="true" />
              <strong>{day.count}</strong>
              <span className="history-weekday">{day.weekday}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="activity" aria-labelledby="activity-title">
        <div className="history-heading">
          <h3 id="activity-title">直近30日</h3>
          <span>続けた日を俯瞰</span>
        </div>
        <div className="activity-grid" id="activity-grid" role="list" aria-describedby="activity-summary">
          {state.activity.map((cell, index) => {
            const className = [
              'activity-day',
              `level-${cell.level}`,
              cell.placeholder ? 'is-placeholder' : '',
              cell.current ? 'is-today' : '',
            ].filter(Boolean).join(' ');

            if (cell.placeholder) {
              return <span className={className} aria-hidden="true" key={`placeholder-${index}`} />;
            }

            return (
              <span
                className={className}
                role="listitem"
                aria-label={cell.ariaLabel}
                aria-current={cell.current ? 'date' : undefined}
                key={`${cell.ariaLabel}-${index}`}
              />
            );
          })}
        </div>
        <p className="hint" id="activity-summary">{state.activitySummary}</p>
      </div>

      <p className="hint">日ごとの回数もこの端末だけに保存します。履歴は最大90日分です。</p>
    </>
  );
}
