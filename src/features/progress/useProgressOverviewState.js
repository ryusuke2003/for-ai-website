import { useSyncExternalStore } from 'react';
import { getProgressSnapshot, subscribeProgress } from './progressStore.js';

export function useProgressOverviewState() {
  return useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot);
}
