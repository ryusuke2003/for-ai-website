import { useRef } from 'react';
import { useCompletionEffectsControl } from './useCompletionEffectsControl.js';
import { useCustomTimerControl } from './useCustomTimerControl.js';
import { useTimerState } from './useTimerState.js';
import { useWakeLockControl } from './useWakeLockControl.js';

const QUICK_PRESETS = Object.freeze([5, 25, 50]);
const OPTION_BUTTON_CLASS = 'rounded-full border-0 bg-transparent px-3 py-2 text-[var(--one-subtle)] disabled:cursor-not-allowed disabled:opacity-45';
const ACTIVE_OPTION_CLASS = 'bg-[var(--one-active-bg)] text-[var(--one-active-fg)] font-extrabold';
const HINT_CLASS = 'hint mt-3 text-[0.82rem] text-[var(--one-muted)]';

function optionButtonClass(active) {
  return active ? `${OPTION_BUTTON_CLASS} ${ACTIVE_OPTION_CLASS}` : OPTION_BUTTON_CLASS;
}

export function TimerSettings() {
  const timerState = useTimerState();
  const customTimer = useCustomTimerControl(timerState.selectedMinutes, timerState.completionReady);
  const completionEffects = useCompletionEffectsControl(timerState);
  const wakeLock = useWakeLockControl(timerState.running);
  const customMinutesRef = useRef(null);

  function applyCustomMinutes() {
    const result = customTimer.apply();
    if (result.focusInput) customMinutesRef.current?.focus();
  }

  return (
    <>
      <div className="presets mt-[18px] flex flex-wrap justify-center gap-2.5" aria-label="タイマー時間と完了通知">
        {QUICK_PRESETS.map((minutes) => {
          const active = timerState.selectedMinutes === minutes;
          return (
            <button key={minutes} type="button" data-minutes={minutes} className={optionButtonClass(active)} aria-pressed={active} disabled={timerState.completionReady} onClick={() => customTimer.selectPreset(minutes)}>
              {minutes}分
            </button>
          );
        })}

        <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-bold text-[var(--one-subtle)] max-[560px]:w-full max-[560px]:justify-center">
          <label htmlFor="custom-minutes">自由設定</label>
          <input
            className="w-[4.8rem] rounded-full border border-[var(--one-control-border-soft)] bg-[var(--one-input-bg)] px-[9px] py-[7px] text-right text-[0.9rem] font-extrabold text-inherit [font-variant-numeric:tabular-nums] disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-2 aria-invalid:border-current max-[560px]:w-[4.2rem]"
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
          <button className={OPTION_BUTTON_CLASS} id="custom-minutes-apply" type="button" aria-describedby="custom-minutes-status" disabled={customTimer.disabled} onClick={applyCustomMinutes}>
            設定
          </button>
        </span>

        <button id="completion-sound-toggle" type="button" className={optionButtonClass(completionEffects.sound.pressed)} aria-pressed={completionEffects.sound.pressed} aria-describedby="completion-sound-status" disabled={completionEffects.sound.disabled} onClick={() => void completionEffects.sound.toggle()}>
          {completionEffects.sound.label}
        </button>
        <button id="completion-notification-toggle" type="button" className={optionButtonClass(completionEffects.notification.pressed)} aria-pressed={completionEffects.notification.pressed} aria-describedby="completion-notification-status" disabled={completionEffects.notification.disabled} onClick={() => void completionEffects.notification.toggle()}>
          {completionEffects.notification.label}
        </button>
        <button id="wake-lock-toggle" type="button" className={optionButtonClass(wakeLock.pressed)} aria-pressed={wakeLock.pressed} aria-describedby="wake-lock-status" disabled={wakeLock.disabled} onClick={() => void wakeLock.toggle()}>
          {wakeLock.label}
        </button>
      </div>

      <p className={HINT_CLASS} id="custom-minutes-status" role="status" aria-live="polite">{customTimer.status}</p>
      <p className={HINT_CLASS} id="completion-sound-status" role="status" aria-live="polite">{completionEffects.sound.status}</p>
      <p className={HINT_CLASS} id="completion-notification-status" role="status" aria-live="polite">{completionEffects.notification.status}</p>
      <p className={HINT_CLASS} id="wake-lock-status" role="status" aria-live="polite">{wakeLock.status}</p>
    </>
  );
}
