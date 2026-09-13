import { useEffect, useRef, useState } from 'react';

const DEFAULT_STATE = {
  presets: [
    { minutes: 10, label: '10分', active: false, pressed: false, disabled: false },
    { minutes: 25, label: '25分', active: true, pressed: true, disabled: false },
    { minutes: 50, label: '50分', active: false, pressed: false, disabled: false },
  ],
  customValue: '25',
  customInvalid: false,
  customDisabled: false,
  customApplyDisabled: false,
  customStatus: '1〜180分の整数でも設定できます。',
  soundLabel: '完了音 OFF',
  soundPressed: false,
  soundDisabled: false,
  soundStatus: '完了音はオフです。オンにすると短い試聴音が鳴ります。',
  notificationLabel: '完了通知 OFF',
  notificationPressed: false,
  notificationDisabled: false,
  notificationStatus: '完了通知はオフです。オンにするとブラウザの通知許可を確認します。',
  wakeLockLabel: '画面維持 OFF',
  wakeLockPressed: false,
  wakeLockDisabled: false,
  wakeLockStatus: '画面維持はオフです。オンにすると集中中だけ画面のスリープを抑えます。',
};

function readBridgeState() {
  return globalThis.ONE_REACT_TIMER_SETTINGS?.snapshot?.() ?? DEFAULT_STATE;
}

function invokeBridge(action, ...args) {
  globalThis.ONE_REACT_TIMER_SETTINGS?.[action]?.(...args);
}

export function TimerSettings() {
  const [state, setState] = useState(readBridgeState);
  const customMinutesRef = useRef(null);

  useEffect(() => {
    function handleState(event) {
      setState(event.detail ?? readBridgeState());
    }

    function handleFocus(event) {
      if (event.detail?.control === 'custom-minutes') {
        customMinutesRef.current?.focus();
      }
    }

    window.addEventListener('one:timer-settings-state', handleState);
    window.addEventListener('one:timer-settings-focus', handleFocus);
    setState(readBridgeState());

    return () => {
      window.removeEventListener('one:timer-settings-state', handleState);
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
          className={state.soundPressed ? 'active' : undefined}
          aria-pressed={state.soundPressed}
          aria-describedby="completion-sound-status"
          disabled={state.soundDisabled}
          onClick={() => invokeBridge('toggleSound')}
        >
          {state.soundLabel}
        </button>
        <button
          id="completion-notification-toggle"
          type="button"
          className={state.notificationPressed ? 'active' : undefined}
          aria-pressed={state.notificationPressed}
          aria-describedby="completion-notification-status"
          disabled={state.notificationDisabled}
          onClick={() => invokeBridge('toggleNotification')}
        >
          {state.notificationLabel}
        </button>
        <button
          id="wake-lock-toggle"
          type="button"
          className={state.wakeLockPressed ? 'active' : undefined}
          aria-pressed={state.wakeLockPressed}
          aria-describedby="wake-lock-status"
          disabled={state.wakeLockDisabled}
          onClick={() => invokeBridge('toggleWakeLock')}
        >
          {state.wakeLockLabel}
        </button>
      </div>

      <p className="hint" id="custom-minutes-status" role="status" aria-live="polite">
        {state.customStatus}
      </p>
      <p className="hint" id="completion-sound-status" role="status" aria-live="polite">
        {state.soundStatus}
      </p>
      <p className="hint" id="completion-notification-status" role="status" aria-live="polite">
        {state.notificationStatus}
      </p>
      <p className="hint" id="wake-lock-status" role="status" aria-live="polite">
        {state.wakeLockStatus}
      </p>
    </>
  );
}
