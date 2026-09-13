import { useEffect, useRef } from 'react';
import { useCompletionEffectsControl } from './useCompletionEffectsControl.js';
import { useTimerSettingsState } from './useTimerSettingsState.js';
import { useTimerState } from './useTimerState.js';
import { useWakeLockControl } from './useWakeLockControl.js';

function invokeBridge(action, ...args) {
  globalThis.ONE_REACT_TIMER_SETTINGS?.[action]?.(...args);
}

export function TimerSettings() {
  const state = useTimerSettingsState();
  const timerState = useTimerState();
  const completionEffects = useCompletionEffectsControl(timerState);
  const wakeLock = useWakeLockControl(timerState.running);
  const customMinutesRef = useRef(null);

  useEffect(() => {
    function handleFocus(event) {
      if (event.detail?.control === 'custom-minutes') {
        customMinutesRef.current?.focus();
      }
    }

    window.addEventListener('one:timer-settings-focus', handleFocus);
    return () => {
      window.removeEventListener('one:timer-settings-focus', handleFocus);
    };
  }, []);

  return (
    <>
      <div className="presets" aria-label="タイマー時間と完了通知">
        {state.presets.map((preset) => (
          <button
            key={preset.minutes}
            type="button"
            data-minutes={preset.minutes}
            className={preset.active ? 'active' : undefined}
            aria-pressed={preset.pressed}
            disabled={preset.disabled}
            onClick={() => invokeBridge('selectPreset', preset.minutes)}
          >
            {preset.label}
          </button>
        ))}

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
            value={state.customValue}
            aria-describedby="custom-minutes-status"
            aria-invalid={state.customInvalid}
            disabled={state.customDisabled}
            ref={customMinutesRef}
            onChange={(event) => invokeBridge('setCustomValue', event.target.value)}
            onKeyDown={(event) => {
              if (event.isComposing || event.key !== 'Enter') return;
              event.preventDefault();
              invokeBridge('applyCustom');
            }}
          />
          <span aria-hidden="true">分</span>
          <button
            id="custom-minutes-apply"
            type="button"
            aria-describedby="custom-minutes-status"
            disabled={state.customApplyDisabled}
            onClick={() => invokeBridge('applyCustom')}
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
        {state.customStatus}
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
