import { useEffect, useMemo, useState } from 'react';
import { AppFooter } from './components/AppFooter.jsx';
import { AppNavigation } from './components/AppNavigation.jsx';
import { StorageHealthStatus } from './components/StorageHealthStatus.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { openFullWindow } from './desktop/trayWindow.js';
import { BackupPanel } from './features/backup/BackupPanel.jsx';
import { ProgressDetails } from './features/progress/ProgressDetails.jsx';
import { ProgressOverview } from './features/progress/ProgressOverview.jsx';
import { buildProgressInsights } from './features/progress/progressInsights.js';
import { useDailyGoalControl } from './features/progress/useDailyGoalControl.js';
import { useProgressOverviewState } from './features/progress/useProgressOverviewState.js';
import { TimerControls } from './features/timer/TimerControls.jsx';
import { TimerDisplay } from './features/timer/TimerDisplay.jsx';
import { TimerSettings } from './features/timer/TimerSettings.jsx';
import { TrayTimerPanel } from './features/timer/TrayTimerPanel.jsx';
import { useFocusModeControl } from './features/timer/useFocusModeControl.js';
import { useTimerShortcuts } from './features/timer/useTimerShortcuts.js';
import { useTimerState } from './features/timer/useTimerState.js';
import { TodoPageWithActions } from './features/todo/TodoPageWithActions.jsx';
import { buildTrayTimelineMarks } from './features/todo/trayTimelineMarks.js';

const BREAK_MINUTES = 5;
const TODO_STORAGE_KEY = 'one.todos.v2';
const LEGACY_TODO_STORAGE_KEY = 'one.todos.v1';
const CARD_CLASS = 'card my-4 rounded-3xl border border-[var(--one-border)] bg-[var(--one-card)] p-7 shadow-[var(--one-card-shadow)] backdrop-blur-[14px] max-[560px]:rounded-[20px] max-[560px]:p-[22px]';
const SECTION_HEADING_CLASS = 'section-heading mb-5 flex items-baseline gap-3.5 text-left';
const STEP_CLASS = 'text-[0.78rem] font-extrabold tracking-[0.12em] text-[var(--one-subtle)]';
const HINT_CLASS = 'hint mt-3 text-[0.82rem] text-[var(--one-muted)]';

function pageFromHash() {
  if (window.location.hash === '#todo') return 'todo';
  if (window.location.hash === '#tray-todo') return 'tray-todo';
  if (window.location.hash === '#tray-timer') return 'tray-timer';
  return 'timer';
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
        <TimerControls focusModeActive={focusMode.active} onToggleFocusMode={focusMode.toggle} />
      </div>
      <p className={HINT_CLASS}>キーボード: Spaceで開始/一時停止 · Fで集中表示 · Escで解除</p>
      <TimerSettings />
      {breakMode ? <p className={HINT_CLASS}>5分プリセットは休憩用です。完了しても集中回数には加算されません。</p> : null}
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

function readTrayTodos() {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY) ?? localStorage.getItem(LEGACY_TODO_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw)
      .filter((todo) => todo && typeof todo.id === 'string' && typeof todo.text === 'string')
      .map((todo) => ({
        ...todo,
        completed: todo.completed === true,
        startMinute: Number(todo.startMinute) || 0,
        duration: Math.max(5, Number(todo.duration) || 25),
      }))
      .sort((left, right) => left.startMinute - right.startMinute || left.id.localeCompare(right.id));
  } catch {
    return [];
  }
}

function formatMinute(value) {
  if (value >= 1440) return '24:00';
  const safe = Math.max(0, value);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function TrayTodoPanel({ onShowTimer }) {
  const [todos, setTodos] = useState(readTrayTodos);
  const range = useMemo(() => {
    if (todos.length === 0) return null;
    const first = Math.min(...todos.map((todo) => todo.startMinute));
    const last = Math.max(...todos.map((todo) => todo.startMinute + todo.duration));
    const span = Math.max(5, last - first);
    const scale = Math.max(4, 300 / span);
    const marks = buildTrayTimelineMarks(first, last);
    return { first, last, scale, height: span * scale, marks };
  }, [todos]);

  function toggleTodo(id) {
    const next = todos.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed } : todo);
    setTodos(next);
    try {
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(next));
    } catch {
      window.dispatchEvent(new Event('one:storage-error'));
    }
  }

  return (
    <section className="min-h-screen bg-[var(--one-page)] p-4 text-[var(--one-fg)]">
      <div className="mx-auto flex h-full max-w-[520px] flex-col rounded-[28px] border border-[var(--one-border)] bg-[var(--one-card)] p-5 shadow-[var(--one-card-shadow)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button className="rounded-full border border-[var(--one-border)] px-3.5 py-2 text-[0.76rem] font-extrabold" type="button" onClick={onShowTimer}>タイマーへ</button>
          <strong className="text-[0.92rem]">今日の時間割</strong>
          <button className="rounded-full border border-[var(--one-border)] bg-[var(--one-active-bg)] px-3.5 py-2 text-[0.76rem] font-extrabold" type="button" onClick={() => void openFullWindow('todo')}>Todoを開く</button>
        </div>

        {range ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--one-border)] bg-[var(--one-input-bg)]">
            <div className="relative" style={{ height: `${range.height}px` }} data-testid="tray-todo-timeline">
              {range.marks.map((minute) => {
                const top = (minute - range.first) * range.scale;
                const endpoint = minute === range.first || minute === range.last;
                const labelTransform = minute === range.first
                  ? 'translateY(8px)'
                  : minute === range.last
                    ? 'translateY(calc(-100% - 8px))'
                    : 'translateY(-50%)';

                return (
                  <div className="absolute left-0 right-0" key={minute} style={{ top: `${top}px` }} aria-hidden="true">
                    <span
                      className="absolute left-3 text-[0.68rem] font-bold text-[var(--one-subtle)]"
                      style={{ transform: labelTransform }}
                    >
                      {formatMinute(minute)}
                    </span>
                    <span className={`absolute left-[62px] right-0 border-t ${endpoint ? 'border-[var(--one-border)]' : 'border-dashed border-[var(--one-border-soft)]'}`} />
                  </div>
                );
              })}

              {todos.map((todo) => {
                const top = (todo.startMinute - range.first) * range.scale;
                const height = Math.max(18, todo.duration * range.scale - 4);
                return (
                  <article key={todo.id} className={`absolute left-[72px] right-3 rounded-xl border border-[var(--one-border-strong)] bg-[var(--one-card)] px-3 ${todo.completed ? 'opacity-55' : ''}`} style={{ top: `${top + 2}px`, height: `${height}px` }} aria-label={`${formatMinute(todo.startMinute)} ${todo.text}`}>
                    <div className="flex h-full items-center gap-2">
                      <input type="checkbox" checked={todo.completed} aria-label={`${todo.text}を完了`} onChange={() => toggleTodo(todo.id)} />
                      <strong className={`min-w-0 flex-1 truncate text-[0.82rem] ${todo.completed ? 'line-through' : ''}`}>{todo.text}</strong>
                      <span className="text-[0.7rem] font-bold text-[var(--one-muted)]">{formatMinute(todo.startMinute)}–{formatMinute(todo.startMinute + todo.duration)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--one-border-strong)] px-6 text-center text-[0.82rem] font-bold text-[var(--one-muted)]">今日の予定はまだありません。</div>
        )}
      </div>
    </section>
  );
}

export function App() {
  const timerState = useTimerState();
  const focusMode = useFocusModeControl(timerState.completionReady);
  const [page, setPage] = useState(pageFromHash);

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

  if (page === 'tray-timer') {
    return <TrayTimerPanel onShowTodo={() => { window.location.hash = 'tray-todo'; }} />;
  }

  if (page === 'tray-todo') {
    return <TrayTodoPanel onShowTimer={() => { window.location.hash = 'tray-timer'; }} />;
  }

  const shellWidthClass = page === 'todo'
    ? 'w-[min(1240px,calc(100%_-_32px))]'
    : 'w-[min(760px,calc(100%_-_32px))]';

  return (
    <main className={`shell mx-auto ${shellWidthClass} pb-10 pt-8 max-[560px]:pt-6`}>
      <header className="mb-4 flex items-start justify-between gap-4 max-[560px]:flex-col max-[560px]:gap-0">
        <AppNavigation page={page} onNavigate={navigate} />
        <ThemeSwitcher />
        <div className="sr-only"><StorageHealthStatus /></div>
      </header>

      {page === 'todo' ? (
        <TodoPageWithActions />
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
