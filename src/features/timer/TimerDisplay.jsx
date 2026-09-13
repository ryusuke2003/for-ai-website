import { useEffect } from 'react';
import { useTimerState } from './useTimerState.js';

const DEFAULT_DOCUMENT_TITLE = 'ONE — 集中タイマー';
const endTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function endTimePresentation(state) {
  if (!state.running || !Number.isFinite(state.endAt)) {
    return { hidden: true, text: '', dateTime: '' };
  }

  const endDate = new Date(state.endAt);
  if (Number.isNaN(endDate.getTime())) {
    return { hidden: true, text: '', dateTime: '' };
  }

  const formattedTime = endTimeFormatter.format(endDate);
  return {
    hidden: false,
    text: dateKey(endDate) === dateKey(new Date())
      ? formattedTime
      : `${endDate.getMonth() + 1}/${endDate.getDate()} ${formattedTime}`,
    dateTime: endDate.toISOString(),
  };
}

function documentTitleFor(state, timeText) {
  if (state.completionReady) return '完了！ — ONE';
  if (state.running) return `${timeText} — ONE`;

  const fullDuration = Math.max(1, state.selectedMinutes * 60);
  const partiallyElapsed = state.remainingSeconds > 0 && state.remainingSeconds < fullDuration;
  return partiallyElapsed
    ? `${timeText} 一時停止 — ONE`
    : DEFAULT_DOCUMENT_TITLE;
}

export function TimerDisplay() {
  const state = useTimerState();
  const fullDuration = Math.max(1, state.selectedMinutes * 60);
  const remainingSeconds = Math.min(fullDuration, Math.max(0, state.remainingSeconds));
  const elapsedSeconds = fullDuration - remainingSeconds;
  const percentage = Math.round((elapsedSeconds / fullDuration) * 100);
  const timeText = formatTime(remainingSeconds);
  const endTime = endTimePresentation(state);

  useEffect(() => {
    document.title = documentTitleFor(state, timeText);
  }, [state.completionReady, state.running, state.selectedMinutes, state.remainingSeconds, timeText]);

  return (
    <>
      <div
        className="timer"
        id="timer"
        role="timer"
        aria-label={`残り時間 ${timeText}`}
      >
        {timeText}
      </div>
      <progress
        className="timer-progress"
        id="timer-progress"
        max={fullDuration}
        value={elapsedSeconds}
        aria-label="集中時間の進捗"
        aria-valuetext={`${percentage}%`}
      />
      <p
        className="timer-status"
        id="timer-status"
        role="status"
        aria-live="polite"
      >
        {state.feedback}
      </p>
      <p
        className="timer-status timer-end-time"
        id="timer-end-time"
        hidden={endTime.hidden}
      >
        終了予定{' '}
        <time
          id="timer-end-at"
          dateTime={endTime.dateTime || undefined}
        >
          {endTime.text}
        </time>
      </p>
    </>
  );
}
