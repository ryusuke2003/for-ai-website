import { useCallback, useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

export function currentMinuteOfDay(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function millisecondsUntilNextMinute(date = new Date()) {
  const elapsedInMinute = date.getSeconds() * 1000 + date.getMilliseconds();
  return MINUTE_MS - elapsedInMinute;
}

export function useCurrentMinute() {
  const [currentMinute, setCurrentMinute] = useState(() => currentMinuteOfDay());

  const refreshCurrentMinute = useCallback(() => {
    setCurrentMinute(currentMinuteOfDay());
  }, []);

  useEffect(() => {
    let intervalId = null;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCurrentMinute();
    };
    const timeoutId = window.setTimeout(() => {
      refreshCurrentMinute();
      intervalId = window.setInterval(refreshCurrentMinute, MINUTE_MS);
    }, millisecondsUntilNextMinute());
    window.addEventListener('focus', refreshCurrentMinute);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshCurrentMinute);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshCurrentMinute]);

  return { currentMinute, refreshCurrentMinute };
}
