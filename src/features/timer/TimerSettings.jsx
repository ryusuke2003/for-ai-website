import { useRef } from 'react';
import { useCompletionEffectsControl } from './useCompletionEffectsControl.js';
import { useCustomTimerControl } from './useCustomTimerControl.js';
import { useTimerState } from './useTimerState.js';
import { useWakeLockControl } from './useWakeLockControl.js';

const QUICK_PRESETS = Object.freeze([10, 25, 50]);

export function TimerSettings() {
  const timerState = useTimerState();
  const customTimer = useCustomTimerControl(
    timerState.selectedMinutes,
    timerState.completionReady,
  );
  const completionEffects = useCompletionEffectsControl(timerState);
  const wakeLock = useWakeLockControl(timerState.running);
  const customMinutesRef = useRef(null);

  function applyCustomMinutes() {
    const result = customTimer.apply();
    if (result.focusInput) customMinutesRef.current?.focus();
  }

  return (
    <>
      <div className="presets" aria-label="タイマー時間と完了通知">
        {QUICK_PRESETS.map((minutes) => {
          const active = timerState.selectedMinutes === minutes;
          return (
            <button
              key={minutes}
              type="button"
              data-minutes={minutes}
              className={active ? 'active' : undefined}
              aria-pressed={active}
              disabled={timerState.completionReady}
              onClick={() => customTimer.selectPreset(minutes)}
            >
              {minutes}分
            </button>
          );
        })}

        <span className="custom-time">
          <label htmlFor="custom-minutes">自由設定</label>
          <input
            className="custom-minutes-input"
            id="custom-minutes"
            type="number"
            min="1"
            max="180"
            step="1"
            inputMode="numeric"
            value={customTimer.value}
            aria-describedby="custom-minutes-status"
            aria-invalid={customTimer.invalid}
            disabled={customTimer.disabled}
            ref={customMinutesRef}
            onChange={(event) => customTimer.change(event.target.value)}
            onKeyDown={(event) => {
              if (event.isComposing || event.key !== 'Enter') return;
              event.preventDefault();
              applyCustomMinutes();
            }}
          />
          <span aria-hidden="true">分</span>
          <button
            id="custom-minutes-apply"
            type="button"
            aria-describedby="custom-minutes-status"
            disabled={customTimer.disabled}
            onClick={applyCustomMinutes}
          >
            設定
          </button>
        </span>

        <button
          id="completion-sound-toggle"
          type="button"
          className={completionEffects.sound.pressed ? 'active' : undefined}
          aria-pressed={completionEffects.sound.pressed}
          aria-describedby="completion-sound-status"
          disabled={completionEffects.sound.disabled}
          onClick={() => void completionEffects.sound.toggle()}
        >
          {completionEffects.sound.label}
        </button>
        <button
          id="completion-notification-toggle"
          type="button"
          className={completionEffects.notification.pressed ? 'active' : undefined}
          aria-pressed={completionEffects.notification.pressed}
          aria-describedby="completion-notification-status"
          disabled={completionEffects.notification.disabled}
          onClick={() => void completionEffects.notification.toggle()}
        >
          {completionEffects.notification.label}
        </button>
        <button
          id="wake-lock-toggle"
          type="button"
          className={wakeLock.pressed ? 'active' : undefined}
          aria-pressed={wakeLock.pressed}
          aria-describedby="wake-lock-status"
          disabled={wakeLock.disabled}
          onClick={() => void wakeLock.toggle()}
        >
          {wakeLock.label}
        </button>
      </div>

      <p className="hint" id="custom-minutes-status" role="status" aria-live="polite">
        {customTimer.status}
      </p>
      <p className="hint" id="completion-sound-status" role="status" aria-live="polite">
        {completionEffects.sound.status}
      </p>
      <p className="hint" id="completion-notification-status" role="status" aria-live="polite">
        {completionEffects.notification.status}
      </p>
      <p className="hint" id="wake-lock-status" role="status" aria-live="polite">
        {wakeLock.status}
      </p>
    </>
  );
}
