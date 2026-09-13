import { useCallback, useEffect, useState } from 'react';
import { timerActions } from './timerStore.js';

const DEFAULT_STATUS = '1〜180分の整数でも設定できます。';

function timerLimits() {
  const guard = globalThis.ONE_TIMER_STATE_GUARD;
  return {
    min: Number.isInteger(guard?.minMinutes) ? guard.minMinutes : 1,
    max: Number.isInteger(guard?.maxMinutes) ? guard.maxMinutes : 180,
  };
}

function parseMinutes(raw) {
  const { min, max } = timerLimits();
  const normalized = String(raw ?? '').trim();
  if (!/^\d{1,3}$/.test(normalized)) return null;

  const minutes = Number(normalized);
  return Number.isInteger(minutes) && minutes >= min && minutes <= max
    ? minutes
    : null;
}

export function useCustomTimerControl(selectedMinutes, locked) {
  const [value, setValue] = useState(String(selectedMinutes));
  const [invalid, setInvalid] = useState(false);
  const [status, setStatus] = useState(DEFAULT_STATUS);

  useEffect(() => {
    setValue(String(selectedMinutes));
    setInvalid(false);
  }, [selectedMinutes]);

  useEffect(() => {
    function handleIdleTimerSync(event) {
      const minutes = event.detail?.selectedMinutes;
      if (parseMinutes(minutes) === null) return;
      setValue(String(minutes));
      setInvalid(false);
      setStatus(`別のタブで${minutes}分に変更されました。`);
    }

    window.addEventListener('one:idle-timer-sync', handleIdleTimerSync);
    return () => {
      window.removeEventListener('one:idle-timer-sync', handleIdleTimerSync);
    };
  }, []);

  const change = useCallback((nextValue) => {
    setValue(String(nextValue ?? ''));
    setInvalid(false);
    setStatus(DEFAULT_STATUS);
  }, []);

  const selectPreset = useCallback((minutes) => {
    if (locked) return false;
    const applied = timerActions.selectMinutes(minutes);
    if (applied) setStatus(DEFAULT_STATUS);
    return applied;
  }, [locked]);

  const apply = useCallback(() => {
    if (locked) {
      setStatus('未記録の完了がある間はタイマー時間を変更できません。');
      return { ok: false, focusInput: false };
    }

    const minutes = parseMinutes(value);
    if (minutes === null) {
      setInvalid(true);
      setStatus('1〜180分の整数を入力してください。');
      return { ok: false, focusInput: true };
    }

    const applied = timerActions.applyCustomMinutes(minutes);
    if (!applied) return { ok: false, focusInput: false };

    setInvalid(false);
    setStatus(`${minutes}分に設定しました。`);
    return { ok: true, focusInput: false };
  }, [locked, value]);

  return {
    value,
    invalid,
    status,
    disabled: locked,
    change,
    selectPreset,
    apply,
  };
}
