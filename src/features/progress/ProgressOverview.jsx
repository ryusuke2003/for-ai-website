import { progressActions } from './progressStore.js';

export function ProgressOverview({ state, todayAriaLabel = '' }) {
  return (
    <>
      <div className="controls">
        <button
          className="done-button"
          id="done-button"
          type="button"
          aria-describedby="done-hint"
          disabled={state.doneDisabled}
          onClick={progressActions.record}
        >
          {state.doneLabel}
        </button>
        <button
          className="secondary"
          id="discard-button"
          type="button"
          aria-describedby="done-hint"
          hidden={state.discardHidden}
          onClick={progressActions.discard}
        >
          記録せず破棄する
        </button>
      </div>
      <p className="hint" id="done-hint">
        タイマーが0:00になった集中だけ、1回だけ記録できます。完了後は「記録する」か「記録せず破棄する」を選ぶまで次のタイマー操作をロックします。日付をまたいでも完了した日の回数に入ります。
      </p>

      <div className="progress-summary" aria-live="polite">
        <div className="progress-stat">
          <strong id="today-count" aria-label={todayAriaLabel || undefined}>{state.todayCount}</strong>
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
