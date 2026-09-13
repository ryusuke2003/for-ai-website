import { progressActions } from './progressStore.js';

const ACTION_BUTTON_CLASS = 'min-h-12 rounded-full border border-[#1d1d1f] px-[22px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45';
const HINT_CLASS = 'mt-3 text-[0.82rem] text-[#7a766d]';
const STAT_CLASS = 'rounded-2xl bg-[rgba(29,29,31,.035)] px-4 py-[18px] text-center';

export function ProgressOverview({ state, todayAriaLabel = '' }) {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-2.5">
        <button
          className={`${ACTION_BUTTON_CLASS} w-full bg-[#1d1d1f] text-white disabled:border-[rgba(29,29,31,.18)] disabled:bg-transparent disabled:text-[#8b877e]`}
          id="done-button"
          type="button"
          aria-describedby="done-hint"
          disabled={state.doneDisabled}
          onClick={progressActions.record}
        >
          {state.doneLabel}
        </button>
        <button
          className={`${ACTION_BUTTON_CLASS} bg-transparent text-inherit`}
          id="discard-button"
          type="button"
          aria-describedby="done-hint"
          hidden={state.discardHidden}
          onClick={progressActions.discard}
        >
          記録せず破棄する
        </button>
      </div>
      <p className={HINT_CLASS} id="done-hint">
        タイマーが0:00になった集中だけ、1回だけ記録できます。完了後は「記録する」か「記録せず破棄する」を選ぶまで次のタイマー操作をロックします。日付をまたいでも完了した日の回数に入ります。
      </p>

      <div className="mt-[18px] grid grid-cols-2 gap-2.5" aria-live="polite">
        <div className={STAT_CLASS}>
          <strong className="block text-[1.8rem] leading-none" id="today-count" aria-label={todayAriaLabel || undefined}>{state.todayCount}</strong>
          <span className="mt-2 block text-[0.72rem] font-bold text-[#77736a]">今日</span>
        </div>
        <div className={STAT_CLASS}>
          <strong className="block text-[1.8rem] leading-none" id="week-count">{state.weekCount}</strong>
          <span className="mt-2 block text-[0.72rem] font-bold text-[#77736a]">今週</span>
        </div>
        <div className={STAT_CLASS}>
          <strong className="block text-[1.8rem] leading-none" id="streak-count" aria-label={state.streakAriaLabel}>{state.streakCount}</strong>
          <span className="mt-2 block text-[0.72rem] font-bold text-[#77736a]">連続日</span>
        </div>
        <div className={STAT_CLASS}>
          <strong className="block text-[1.8rem] leading-none" id="done-count">{state.doneCount}</strong>
          <span className="mt-2 block text-[0.72rem] font-bold text-[#77736a]">累計</span>
        </div>
      </div>
      <p className={HINT_CLASS} id="streak-status">{state.streakStatus}</p>
    </>
  );
}
