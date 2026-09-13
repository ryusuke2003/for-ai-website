import { useEffect } from 'react';
import { openFullWindow } from '../../desktop/trayWindow.js';
import { progressActions } from '../progress/progressStore.js';
import { TimerDisplay } from './TimerDisplay.jsx';
import { timerActions } from './timerStore.js';
import { advanceTrayTimerAfterCompletion } from './trayTimerCycle.js';
import { useTimerState } from './useTimerState.js';

const BUTTON_CLASS = 'min-h-11 rounded-full border border-[var(--one-control-border)] px-5 text-[0.88rem] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45';
const TRAY_CYCLE_ACTIONS = Object.freeze({
  record: () => progressActions.record(),
  discard: () => progressActions.discard(),
  selectMinutes: (minutes) => timerActions.selectMinutes(minutes),
});

function startLabelFor(state) {
  if (state.running) return '一時停止';

  const fullDuration = Math.max(1, state.selectedMinutes * 60);
  if (state.remainingSeconds > 0 && state.remainingSeconds < fullDuration) return '再開';
  if (state.remainingSeconds === 0) return 'もう一度';
  return 'スタート';
}

export function TrayTimerPanel({ onShowTodo }) {
  const state = useTimerState();

  useEffect(() => {
    advanceTrayTimerAfterCompletion(state, TRAY_CYCLE_ACTIONS);
  }, [state.completionReady, state.selectedMinutes]);

  return (
    <section className="min-h-screen bg-[var(--one-page)] p-4 text-[var(--one-fg)]">
      <div className="mx-auto flex h-full max-w-[520px] flex-col rounded-[28px] border border-[var(--one-border)] bg-[var(--one-card)] p-5 shadow-[var(--one-card-shadow)]">
        <div className="mb-1 flex items-center justify-between gap-3">
          <button
            className="rounded-full border border-[var(--one-border)] bg-transparent px-3.5 py-2 text-[0.76rem] font-extrabold text-[var(--one-muted)] hover:border-[var(--one-border-strong)] hover:text-[var(--one-fg)]"
            type="button"
            onClick={onShowTodo}
          >
            Todoへ
          </button>
          <span className="text-[0.72rem] font-extrabold tracking-[0.1em] text-[var(--one-subtle)]">TIMER</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center text-center">
          <TimerDisplay />
          <div className="mt-1 flex flex-wrap justify-center gap-2.5">
            <button
              className={`${BUTTON_CLASS} bg-[var(--one-primary-bg)] text-[var(--one-primary-fg)]`}
              type="button"
              aria-pressed={state.running}
              disabled={state.completionReady}
              onClick={() => timerActions.toggle()}
            >
              {startLabelFor(state)}
            </button>
            <button
              className={`${BUTTON_CLASS} bg-transparent text-inherit`}
              type="button"
              disabled={state.completionReady}
              onClick={() => timerActions.reset()}
            >
              リセット
            </button>
            <button
              className={`${BUTTON_CLASS} bg-[var(--one-active-bg)] text-[var(--one-active-fg)]`}
              type="button"
              onClick={() => void openFullWindow('timer')}
            >
              タイマーを開く
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
