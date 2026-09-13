import { useCallback, useEffect, useMemo, useState } from 'react';

const DAILY_GOAL_STORAGE_KEY = 'one.dailyGoal.v1';
const MIN_DAILY_GOAL = 1;
const MAX_DAILY_GOAL = 12;
const MAX_DAILY_GOAL_STATE_BYTES = 128;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_STATUS = '今日の目標は未設定です。1〜12回で設定できます。';

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(key) {
  if (typeof key !== 'string' || !DATE_KEY_PATTERN.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function isPlainDailyGoalState(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseDailyGoalState(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DAILY_GOAL_STATE_BYTES) return null;

  try {
    const value = JSON.parse(raw);
    if (!isPlainDailyGoalState(value)) return null;
    if (Object.keys(value).length !== 2 || !Object.hasOwn(value, 'date') || !Object.hasOwn(value, 'goal')) return null;
    if (!isValidDateKey(value.date)) return null;
    if (!Number.isInteger(value.goal) || value.goal < MIN_DAILY_GOAL || value.goal > MAX_DAILY_GOAL) return null;
    return { date: value.date, goal: value.goal };
  } catch {
    return null;
  }
}

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function readStoredDailyGoal() {
  try {
    return { ok: true, raw: localStorage.getItem(DAILY_GOAL_STORAGE_KEY) };
  } catch {
    reportStorageFailure();
    return { ok: false, raw: null };
  }
}

function removeStoredDailyGoal(expectedRaw) {
  try {
    const current = localStorage.getItem(DAILY_GOAL_STORAGE_KEY);
    if (expectedRaw !== undefined && current !== expectedRaw) return true;

    localStorage.removeItem(DAILY_GOAL_STORAGE_KEY);
    if (localStorage.getItem(DAILY_GOAL_STORAGE_KEY) === null) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

function persistDailyGoal(goal, todayKey) {
  const payload = JSON.stringify({ date: todayKey, goal });

  try {
    localStorage.setItem(DAILY_GOAL_STORAGE_KEY, payload);
    if (localStorage.getItem(DAILY_GOAL_STORAGE_KEY) === payload) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

function parseDailyGoalInput(raw) {
  const normalized = String(raw ?? '').trim();
  if (normalized === '') return null;

  const value = Number(normalized);
  return Number.isInteger(value) && value >= MIN_DAILY_GOAL && value <= MAX_DAILY_GOAL
    ? value
    : null;
}

function normalizeTodayCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

export function useDailyGoalControl(todayCountValue) {
  const [goal, setGoal] = useState(null);
  const [goalDate, setGoalDate] = useState(null);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState('');

  const todayCount = normalizeTodayCount(todayCountValue);
  const todayKey = dateKey();

  const applyStoredState = useCallback((state) => {
    if (!state || state.date !== dateKey()) {
      setGoal(null);
      setGoalDate(null);
      setValue('');
      setInvalid(false);
      return false;
    }

    setGoal(state.goal);
    setGoalDate(state.date);
    setValue(String(state.goal));
    setInvalid(false);
    return true;
  }, []);

  const refreshFromStorage = useCallback(() => {
    const { ok, raw } = readStoredDailyGoal();
    if (!ok) return;

    if (raw === null) {
      applyStoredState(null);
      setPersistenceWarning('');
      return;
    }

    const state = parseDailyGoalState(raw);
    if (state && state.date === dateKey()) {
      applyStoredState(state);
      setPersistenceWarning('');
      return;
    }

    applyStoredState(null);
    setPersistenceWarning(
      removeStoredDailyGoal(raw)
        ? ''
        : ' 期限切れまたは不正な目標データを端末から削除できませんでした。',
    );
  }, [applyStoredState]);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== DAILY_GOAL_STORAGE_KEY) return;

      if (event.newValue === null) {
        applyStoredState(null);
        setPersistenceWarning('');
        return;
      }

      const state = parseDailyGoalState(event.newValue);
      if (!state) return;

      applyStoredState(state.date === dateKey() ? state : null);
      setPersistenceWarning('');
    }

    function handlePageShow() {
      refreshFromStorage();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') refreshFromStorage();
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyStoredState, refreshFromStorage]);

  useEffect(() => {
    if (goalDate !== null && goalDate !== todayKey) refreshFromStorage();
  }, [goalDate, refreshFromStorage, todayKey]);

  const change = useCallback((nextValue) => {
    setValue(String(nextValue ?? ''));
    setInvalid(false);
    setPersistenceWarning('');
  }, []);

  const apply = useCallback(() => {
    const nextGoal = parseDailyGoalInput(value);
    if (nextGoal === null) {
      setInvalid(true);
      setPersistenceWarning('');
      return false;
    }

    const currentDate = dateKey();
    const persisted = persistDailyGoal(nextGoal, currentDate);
    setGoal(nextGoal);
    setGoalDate(currentDate);
    setValue(String(nextGoal));
    setInvalid(false);
    setPersistenceWarning(
      persisted
        ? ''
        : ' このタブでは反映していますが、端末へ保存できませんでした。再読み込みすると目標が解除される可能性があります。',
    );
    return true;
  }, [value]);

  const clear = useCallback(() => {
    const removed = removeStoredDailyGoal();
    setGoal(null);
    setGoalDate(null);
    setValue('');
    setInvalid(false);
    setPersistenceWarning(
      removed
        ? ''
        : ' このタブでは解除しましたが、端末の保存値を削除できませんでした。再読み込みすると目標が戻る可能性があります。',
    );
  }, []);

  return useMemo(() => {
    const activeGoal = goalDate === todayKey && Number.isInteger(goal) ? goal : null;
    const hasGoal = activeGoal !== null;
    const remaining = hasGoal ? Math.max(activeGoal - todayCount, 0) : 0;
    const achieved = hasGoal && remaining === 0;
    const progressValue = hasGoal ? Math.min(todayCount, activeGoal) : 0;
    const progressAriaValueText = hasGoal
      ? achieved
        ? `目標${activeGoal}回を達成、現在${todayCount}回`
        : `目標${activeGoal}回中${todayCount}回`
      : '';
    const todayAriaLabel = hasGoal
      ? achieved
        ? `今日 ${todayCount}回、目標${activeGoal}回を達成`
        : `今日 ${todayCount}回、目標${activeGoal}回まであと${remaining}回`
      : '';

    if (invalid) {
      return {
        value,
        invalid: true,
        clearHidden: !hasGoal,
        status: '今日の目標は1〜12回の整数で設定してください。',
        progressHidden: !hasGoal,
        progressMax: activeGoal ?? 1,
        progressValue,
        progressAriaValueText,
        todayAriaLabel,
        change,
        apply,
        clear,
      };
    }

    if (!hasGoal) {
      return {
        value,
        invalid: false,
        clearHidden: true,
        status: `${DEFAULT_STATUS}${persistenceWarning}`,
        progressHidden: true,
        progressMax: 1,
        progressValue: 0,
        progressAriaValueText: '',
        todayAriaLabel: '',
        change,
        apply,
        clear,
      };
    }

    return {
      value,
      invalid: false,
      clearHidden: false,
      status: achieved
        ? `今日の目標 ${activeGoal}回を達成しました。現在${todayCount}回です。${persistenceWarning}`
        : `今日の目標 ${activeGoal}回 · 現在${todayCount}回 · あと${remaining}回。${persistenceWarning}`,
      progressHidden: false,
      progressMax: activeGoal,
      progressValue,
      progressAriaValueText,
      todayAriaLabel,
      change,
      apply,
      clear,
    };
  }, [apply, change, clear, goal, goalDate, invalid, persistenceWarning, todayCount, todayKey, value]);
}
