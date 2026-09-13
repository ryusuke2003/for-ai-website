import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';
import { StorageHealthStatus } from './components/StorageHealthStatus.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { BackupPanel } from './features/backup/BackupPanel.jsx';
import { ProgressDetails } from './features/progress/ProgressDetails.jsx';
import { ProgressOverview } from './features/progress/ProgressOverview.jsx';
import { useDailyGoalControl } from './features/progress/useDailyGoalControl.js';
import { useProgressDetailsState } from './features/progress/useProgressDetailsState.js';
import { useProgressOverviewState } from './features/progress/useProgressOverviewState.js';
import { TimerControls } from './features/timer/TimerControls.jsx';
import { TimerDisplay } from './features/timer/TimerDisplay.jsx';
import { TimerSettings } from './features/timer/TimerSettings.jsx';
import { useTimerState } from './features/timer/useTimerState.js';

function TimerSection() {
  const state = useTimerState();
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
      <div className="controls"><TimerControls /></div>
      <p className="hint">キーボード: Spaceで開始/一時停止 · Fで集中表示 · Escで解除</p>
      <TimerSettings />
      <p className="hint">選んだ時間と途中経過はこのブラウザに保存されるため、再読み込みしても続きから再開できます。</p>
    </section>
  );
}

function ProgressSection() {
  const overviewState = useProgressOverviewState();
  const detailsState = useProgressDetailsState();
  const dailyGoal = useDailyGoalControl(overviewState.todayCount);

  return (
    <section className="card progress-card" aria-labelledby="done-title">
      <div className="section-heading">
        <span className="step">02</span>
        <h2 id="done-title">集中を記録して振り返る</h2>
      </div>
      <ProgressOverview state={overviewState} todayAriaLabel={dailyGoal.todayAriaLabel} />
      <ProgressDetails state={detailsState} dailyGoal={dailyGoal} />
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

function FocusModeStatus() {
  const state = useTimerState();
  return <p id="focus-mode-status" className="sr-only" aria-live="polite">{state.focusModeStatus}</p>;
}

export function App() {
  return (
    <main className="shell">
      <header className="hero">
        <ThemeSwitcher />
        <HeroIntro />
        <StorageHealthStatus />
      </header>
      <TimerSection />
      <ProgressSection />
      <BackupSection />
      <FocusModeStatus />
      <AppFooter />
    </main>
  );
}
