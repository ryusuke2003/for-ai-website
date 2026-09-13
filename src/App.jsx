import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppFooter } from './components/AppFooter.jsx';
import { AppNavigation } from './components/AppNavigation.jsx';
import { StorageHealthStatus } from './components/StorageHealthStatus.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { BackupPanel } from './features/backup/BackupPanel.jsx';
import { ProgressDetails } from './features/progress/ProgressDetails.jsx';
import { ProgressOverview } from './features/progress/ProgressOverview.jsx';
import { buildProgressInsights } from './features/progress/progressInsights.js';
import { useDailyGoalControl } from './features/progress/useDailyGoalControl.js';
import { useProgressOverviewState } from './features/progress/useProgressOverviewState.js';
import { TimerControls } from './features/timer/TimerControls.jsx';
import { TimerDisplay } from './features/timer/TimerDisplay.jsx';
import { TimerSettings } from './features/timer/TimerSettings.jsx';
import { useFocusModeControl } from './features/timer/useFocusModeControl.js';
import { useTimerShortcuts } from './features/timer/useTimerShortcuts.js';
import { useTimerState } from './features/timer/useTimerState.js';
import {
  canRestoreTodoSchedule,
  resetTodoSchedule,
  restoreTodoSchedule,
} from './features/todo/resetTodoSchedule.js';
import { TodoPage } from './features/todo/TodoPage.jsx';

const BREAK_MINUTES = 5;
const CARD_CLASS = 'card my-4 rounded-3xl border border-[var(--one-border)] bg-[var(--one-card)] p-7 shadow-[var(--one-card-shadow)] backdrop-blur-[14px] max-[560px]:rounded-[20px] max-[560px]:p-[22px]';
const SECTION_HEADING_CLASS = 'section-heading mb-5 flex items-baseline gap-3.5 text-left';
const STEP_CLASS = 'text-[0.78rem] font-extrabold tracking-[0.12em] text-[var(--one-subtle)]';
const HINT_CLASS = 'hint mt-3 text-[0.82rem] text-[var(--one-muted)]';
const TODO_ACTION_CLASS = 'rounded-full border border-[var(--one-border)] bg-transparent px-3 py-1.5 text-[0.72rem] font-extrabold text-[var(--one-muted)] transition hover:border-[var(--one-border-strong)] hover:text-[var(--one-fg)]';

function pageFromHash() {
  return window.location.hash === '#todo' ? 'todo' : 'timer';
}

function SectionHeading({ step, id, children }) {
  return (
    <div className={SECTION_HEADING_CLASS}>
      <span className={STEP_CLASS}>{step}</span>
      <h2 className="m-0 text-[1.05rem]" id={id}>{children}</h2>
    </div>
  );
}

function TimerSection({ focusMode }) {
  const state = useTimerState();
  const breakMode = state.selectedMinutes === BREAK_MINUTES;
  useTimerShortcuts(focusMode.active, focusMode.toggle);

  const stateClass = state.feedbackState === 'complete'
    ? 'border-[var(--one-border-strong)] shadow-[var(--one-card-complete-shadow)]'
    : '';

  return (
    <section className={`${CARD_CLASS} timer-card text-center transition-[border-color,box-shadow] duration-200 ${stateClass}`} aria-labelledby="timer-title">
      <SectionHeading step="01" id="timer-title">{breakMode ? '5分休憩する' : '時間を決めて集中する'}</SectionHeading>
      <TimerDisplay />
      <div className="flex flex-wrap justify-center gap-2.5">
        <TimerControls
          focusModeActive={focusMode.active}
          onToggleFocusMode={focusMode.toggle}
        />
      </div>
      <p className={HINT_CLASS}>キーボード: Spaceで開始/一時停止 · Fで集中表示 · Escで解除</p>
      <TimerSettings />
      {breakMode ? (
        <p className={HINT_CLASS}>5分プリセットは休憩用です。完了しても集中回数には加算されません。</p>
      ) : null}
    </section>
  );
}

function ProgressSection() {
  const progressState = useProgressOverviewState();
  const timerState = useTimerState();
  const insights = buildProgressInsights(progressState.history);
  const dailyGoal = useDailyGoalControl(insights.todayCount);
  const completionReady = timerState.completionReady === true;
  const breakCompletion = completionReady && timerState.selectedMinutes === BREAK_MINUTES;
  const overviewState = {
    ...progressState,
    ...insights,
    breakCompletion,
    doneLabel: breakCompletion
      ? '休憩を終了する'
      : completionReady
        ? 'この集中を記録する ✓'
        : 'タイマー完了後に記録できます',
    doneDisabled: !completionReady,
    discardHidden: !completionReady || breakCompletion,
  };

  return (
    <section className={`${CARD_CLASS} progress-card`} aria-labelledby="done-title">
      <SectionHeading step="02" id="done-title">集中を記録して振り返る</SectionHeading>
      <ProgressOverview state={overviewState} todayAriaLabel={dailyGoal.todayAriaLabel} />
      <ProgressDetails state={insights} dailyGoal={dailyGoal} />
    </section>
  );
}

function BackupSection() {
  return (
    <section className={`${CARD_CLASS} backup-card`} aria-labelledby="backup-title">
      <SectionHeading step="03" id="backup-title">記録をバックアップする</SectionHeading>
      <BackupPanel />
    </section>
  );
}

function FocusModeStatus({ status }) {
  return <p id="focus-mode-status" className="sr-only" aria-live="polite">{status}</p>;
}

function TodoTimelineActions({ version, restoreAvailable, onRestore, onReset }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const timelineTitle = document.getElementById('timeline-title');
    const header = timelineTitle?.parentElement?.parentElement;
    const dateTarget = header?.lastElementChild;
    setTarget(dateTarget instanceof HTMLElement ? dateTarget : null);
  }, [version]);

  if (!target) return null;

  return createPortal(
    <span className="ml-2 inline-flex items-center gap-2 align-middle">
      {restoreAvailable ? (
        <button className={TODO_ACTION_CLASS} type="button" onClick={onRestore}>
          リセットを復元
        </button>
      ) : null}
      <button className={TODO_ACTION_CLASS} type="button" onClick={onReset}>
        今日の予定をリセット
      </button>
    </span>,
    target,
  );
}

export function App() {
  const timerState = useTimerState();
  const focusMode = useFocusModeControl(timerState.completionReady);
  const [page, setPage] = useState(pageFromHash);
  const [todoResetVersion, setTodoResetVersion] = useState(0);
  const [todoResetStatus, setTodoResetStatus] = useState('');
  const [todoRestoreAvailable, setTodoRestoreAvailable] = useState(canRestoreTodoSchedule);

  useEffect(() => {
    function handleHashChange() {
      setPage(pageFromHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function navigate(nextPage) {
    if (nextPage === 'todo') {
      window.location.hash = 'todo';
      return;
    }

    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
      setPage('timer');
      return;
    }

    setPage('timer');
  }

  function resetTodaySchedule() {
    const resetSucceeded = resetTodoSchedule();
    if (!resetSucceeded) {
      setTodoResetStatus('予定をリセットできませんでした。');
      return;
    }

    setTodoResetVersion((current) => current + 1);
    setTodoRestoreAvailable(canRestoreTodoSchedule());
    setTodoResetStatus('今日の予定をリセットしました。復元できます。');
  }

  function restoreTodaySchedule() {
    const restoreSucceeded = restoreTodoSchedule();
    if (!restoreSucceeded) {
      setTodoResetStatus('予定を復元できませんでした。');
      return;
    }

    setTodoResetVersion((current) => current + 1);
    setTodoRestoreAvailable(false);
    setTodoResetStatus('リセット前の予定を復元しました。');
  }

  const shellWidthClass = page === 'todo'
    ? 'w-[min(1240px,calc(100%_-_32px))]'
    : 'w-[min(760px,calc(100%_-_32px))]';

  return (
    <main className={`shell mx-auto ${shellWidthClass} pb-10 pt-8 max-[560px]:pt-6`}>
      <header className="mb-4 flex items-start justify-between gap-4 max-[560px]:flex-col max-[560px]:gap-0">
        <AppNavigation page={page} onNavigate={navigate} />
        <ThemeSwitcher />
        <div className="sr-only">
          <StorageHealthStatus />
        </div>
      </header>

      {page === 'todo' ? (
        <>
          <p className="sr-only" aria-live="polite">{todoResetStatus}</p>
          <TodoPage key={todoResetVersion} />
          <TodoTimelineActions
            version={todoResetVersion}
            restoreAvailable={todoRestoreAvailable}
            onRestore={restoreTodaySchedule}
            onReset={resetTodaySchedule}
          />
        </>
      ) : (
        <>
          <TimerSection focusMode={focusMode} />
          <ProgressSection />
          <BackupSection />
          <FocusModeStatus status={focusMode.status} />
          <AppFooter />
        </>
      )}
    </main>
  );
}
