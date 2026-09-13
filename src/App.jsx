import { AppFooter } from './components/AppFooter.jsx';
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

const BREAK_MINUTES = 5;
const CARD_CLASS = 'card my-4 rounded-3xl border border-[var(--one-border)] bg-[var(--one-card)] p-7 shadow-[var(--one-card-shadow)] backdrop-blur-[14px] max-[560px]:rounded-[20px] max-[560px]:p-[22px]';
const SECTION_HEADING_CLASS = 'section-heading mb-5 flex items-baseline gap-3.5 text-left';
const STEP_CLASS = 'text-[0.78rem] font-extrabold tracking-[0.12em] text-[var(--one-subtle)]';
const HINT_CLASS = 'hint mt-3 text-[0.82rem] text-[var(--one-muted)]';

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
      <p className={HINT_CLASS}>{breakMode ? '5分プリセットは休憩用です。完了しても集中回数には加算されません。' : '選んだ時間と途中経過はこのブラウザに保存されるため、再読み込みしても続きから再開できます。'}</p>
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

export function App() {
  const timerState = useTimerState();
  const focusMode = useFocusModeControl(timerState.completionReady);

  return (
    <main className="shell mx-auto w-[min(760px,calc(100%_-_32px))] pb-10 pt-[72px] max-[560px]:pt-11">
      <header className="mb-4">
        <ThemeSwitcher />
        <div className="sr-only">
          <StorageHealthStatus />
        </div>
      </header>
      <TimerSection focusMode={focusMode} />
      <ProgressSection />
      <BackupSection />
      <FocusModeStatus status={focusMode.status} />
      <AppFooter />
    </main>
  );
}
