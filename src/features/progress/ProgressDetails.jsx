const OPTION_BUTTON_CLASS = 'rounded-full border-0 bg-transparent px-3 py-2 text-[var(--one-subtle)] disabled:cursor-not-allowed disabled:opacity-45';
const INPUT_CLASS = 'w-[4.8rem] rounded-full border border-[var(--one-control-border-soft)] bg-[var(--one-input-bg)] px-[9px] py-[7px] text-right text-[0.9rem] font-extrabold text-inherit [font-variant-numeric:tabular-nums] aria-invalid:border-2 aria-invalid:border-current max-[560px]:w-[4.2rem]';
const HINT_CLASS = 'hint mt-3 text-[0.82rem] text-[var(--one-muted)]';
const SECTION_CLASS = 'mt-6 border-t border-[var(--one-border-soft)] pt-[22px]';
const SECTION_HEADING_CLASS = 'mb-4 flex items-baseline justify-between gap-3';
const HISTORY_LEVEL_CLASS = [
  'h-1 opacity-55',
  'h-3',
  'h-5',
  'h-[30px]',
  'h-10',
];
const ACTIVITY_LEVEL_CLASS = [
  'bg-[var(--one-activity-0)]',
  'bg-[var(--one-activity-1)]',
  'bg-[var(--one-activity-2)]',
  'bg-[var(--one-activity-3)]',
  'bg-[var(--one-activity-4)]',
];

function safeLevel(level) {
  return Number.isInteger(level) && level >= 0 && level <= 4 ? level : 0;
}

export function ProgressDetails({ state, dailyGoal }) {
  return (
    <>
      <div className="presets mt-[18px] flex flex-wrap justify-center gap-2.5" aria-describedby="daily-goal-status">
        <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-bold text-[var(--one-subtle)] max-[560px]:w-full max-[560px]:justify-center">
          <label htmlFor="daily-goal-input">今日の目標</label>
          <input
            className={INPUT_CLASS}
            id="daily-goal-input"
            type="number"
            min="1"
            max="12"
            step="1"
            inputMode="numeric"
            placeholder="3"
            value={dailyGoal.value}
            aria-describedby="daily-goal-status"
            aria-invalid={dailyGoal.invalid}
            onChange={(event) => dailyGoal.change(event.target.value)}
            onKeyDown={(event) => {
              if (event.isComposing || event.key !== 'Enter') return;
              event.preventDefault();
              dailyGoal.apply();
            }}
          />
          <span aria-hidden="true">回</span>
          <button
            className={OPTION_BUTTON_CLASS}
            id="daily-goal-apply"
            type="button"
            aria-describedby="daily-goal-status"
            onClick={dailyGoal.apply}
          >
            設定
          </button>
        </span>
        <button
          className={OPTION_BUTTON_CLASS}
          id="daily-goal-clear"
          type="button"
          aria-describedby="daily-goal-status"
          hidden={dailyGoal.clearHidden}
          onClick={dailyGoal.clear}
        >
          目標を解除
        </button>
      </div>
      <p className={HINT_CLASS} id="daily-goal-status" role="status" aria-live="polite">
        {dailyGoal.status}
      </p>
      <progress
        className="daily-goal-progress"
        max={dailyGoal.progressMax}
        value={dailyGoal.progressValue}
        hidden={dailyGoal.progressHidden}
        aria-label="今日の集中目標の進捗"
        aria-valuetext={dailyGoal.progressAriaValueText || undefined}
      />

      <div className={SECTION_CLASS} aria-labelledby="history-title">
        <div className={SECTION_HEADING_CLASS}>
          <h3 className="m-0 text-[0.92rem]" id="history-title">直近7日</h3>
          <span className="text-[0.75rem] text-[var(--one-muted)]">集中した回数</span>
        </div>
        <div className="grid grid-cols-7 items-end gap-2" id="history-grid" role="list">
          {state.history.map((day, index) => {
            const level = safeLevel(day.level);
            return (
              <div
                className="grid min-w-0 grid-rows-[40px_auto_auto] items-end gap-[5px] text-center"
                role="listitem"
                aria-label={day.ariaLabel}
                aria-current={day.current ? 'date' : undefined}
                key={`${day.ariaLabel}-${index}`}
              >
                <span
                  className={`block min-h-1 w-full rounded-lg bg-[var(--one-bar)] ${HISTORY_LEVEL_CLASS[level]}`}
                  aria-hidden="true"
                />
                <strong className="text-[0.92rem] [font-variant-numeric:tabular-nums]">{day.count}</strong>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.7rem] text-[var(--one-muted)]">{day.weekday}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={SECTION_CLASS} aria-labelledby="activity-title">
        <div className={SECTION_HEADING_CLASS}>
          <h3 className="m-0 text-[0.92rem]" id="activity-title">直近30日</h3>
          <span className="text-[0.75rem] text-[var(--one-muted)]">続けた日を俯瞰</span>
        </div>
        <div
          className="grid w-max max-w-full auto-cols-[14px] grid-flow-col grid-rows-[repeat(7,14px)] gap-[5px] overflow-x-auto p-[3px] max-[560px]:auto-cols-[12px] max-[560px]:grid-rows-[repeat(7,12px)] max-[560px]:gap-1"
          id="activity-grid"
          role="list"
          aria-describedby="activity-summary"
        >
          {state.activity.map((cell, index) => {
            const level = safeLevel(cell.level);
            const className = [
              'block h-[14px] w-[14px] rounded max-[560px]:h-3 max-[560px]:w-3 max-[560px]:rounded-[3px]',
              ACTIVITY_LEVEL_CLASS[level],
              cell.placeholder ? 'invisible' : '',
              cell.current ? 'outline outline-2 outline-offset-1 outline-current' : '',
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
        <p className={HINT_CLASS} id="activity-summary">{state.activitySummary}</p>
      </div>

      <p className={HINT_CLASS}>日ごとの回数もこの端末だけに保存します。履歴は最大90日分です。</p>
    </>
  );
}
