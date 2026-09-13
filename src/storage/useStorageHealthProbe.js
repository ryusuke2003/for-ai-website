import { useEffect } from 'react';

const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';
const LEGACY_TASK_STORAGE_KEYS = ['one.task', 'one.taskDate.v1'];

function cleanupStorageProbe() {
  try {
    localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}

export function probeLocalStorage() {
  const token = `${Date.now()}-${Math.random()}`;
  try {
    localStorage.setItem(STORAGE_HEALTH_PROBE_KEY, token);
    const persisted = localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token;
    if (!persisted) {
      cleanupStorageProbe();
      return false;
    }

    localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
    return localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === null;
  } catch {
    cleanupStorageProbe();
    return false;
  }
}

export function removeLegacyTaskData() {
  try {
    LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    return LEGACY_TASK_STORAGE_KEYS.every((key) => localStorage.getItem(key) === null);
  } catch {
    return false;
  }
}

export function useStorageHealthProbe() {
  useEffect(() => {
    const storageAvailable = probeLocalStorage();
    const legacyCleanupSucceeded = storageAvailable && removeLegacyTaskData();

    if (!storageAvailable || !legacyCleanupSucceeded) {
      window.dispatchEvent(new Event('one:storage-error'));
    }
  }, []);
}
