import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';
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

function TimerSection({ focusMode }) {
  const state = useTimerState();
  useTimerShortcuts(focusMode.active, focusMode.toggle);

  const cardState = state.feedbackState === 'complete'
    ? ' is-complete'
    : state.feedbackState === 'running'
      ? ' is-running'
      : '';

  return (
    <section className={`card timer-card${cardState}`} aria-labelledby="timer-title">
      <div className="section-heading">
        <span className="step">01</span>
        <h2 id="timer-title">時間を決めて集中する</h2>
      </div>
      <TimerDisplay />
      <div className="controls">
        <TimerControls
          focusModeActive={focusMode.active}
          onToggleFocusMode={focusMode.toggle}
        />
      </div>
      <p className="hint">キーボード: Spaceで開始/一時停止 · Fで集中表示 · Escで解除</p>
      <TimerSettings />
      <p className="hint">選んだ時間と途中経過はこのブラウザに保存されるため、再読み込みしても続きから再開できます。</p>
    </section>
  );
}

function ProgressSection() {
  const progressState = useProgressOverviewState();
  const timerState = useTimerState();
  const insights = buildProgressInsights(progressState.history);
  const dailyGoal = useDailyGoalControl(insights.todayCount);
  const completionReady = timerState.completionReady === true;
  const overviewState = {
    ...progressState,
    ...insights,
    doneLabel: completionReady
      ? 'この集中を記録する ✓'
      : 'タイマー完了後に記録できます',
    doneDisabled: !completionReady,
    discardHidden: !completionReady,
  };

  return (
    <section className="card progress-card" aria-labelledby="done-title">
      <div className="section-heading">
        <span className="step">02</span>
        <h2 id="done-title">集中を記録して振り返る</h2>
      </div>
      <ProgressOverview state={overviewState} todayAriaLabel={dailyGoal.todayAriaLabel} />
      <ProgressDetails state={insights} dailyGoal={dailyGoal} />
    </section>
  );
}

function BackupSection() {
  return (
    <section className="card backup-card" aria-labelledby="backup-title">
      <div className="section-heading">
        <span className="step">03</span>
        <h2 id="backup-title">記録をバックアップする</h2>
      </div>
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
    <main className="shell">
      <header className="hero">
        <ThemeSwitcher />
        <HeroIntro />
        <StorageHealthStatus />
      </header>
      <TimerSection focusMode={focusMode} />
      <ProgressSection />
      <BackupSection />
      <FocusModeStatus status={focusMode.status} />
      <AppFooter />
    </main>
  );
}
