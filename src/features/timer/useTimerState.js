import { useSyncExternalStore } from 'react';
import { getTimerSnapshot, subscribeTimer } from './timerStore.js';

export function useTimerState() {
  return useSyncExternalStore(subscribeTimer, getTimerSnapshot, getTimerSnapshot);
}
