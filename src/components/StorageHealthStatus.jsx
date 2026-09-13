import { useEffect, useState } from 'react';

const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';
const LEGACY_TASK_STORAGE_KEYS = ['one.task', 'one.taskDate.v1'];
const STORAGE_HEALTH = {
  checking: { state: 'checking', text: '端末保存の利用状態を確認しています。' },
  available: { state: 'available', text: '端末保存: 利用できます。タイマー・集中記録・設定はこのブラウザだけに保存されます。' },
  unavailable: { state: 'unavailable', text: '⚠ 端末保存を利用できません。今の画面では使えますが、再読み込みするとタイマー・集中記録・設定が消える可能性があります。' },
};

function cleanupStorageProbe() {
  try {
    localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}

function probeLocalStorage() {
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

function removeLegacyTaskData() {
  try {
    LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    return LEGACY_TASK_STORAGE_KEYS.every((key) => localStorage.getItem(key) === null);
  } catch {
    return false;
  }
}

function reportStorageHealthFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

export function StorageHealthStatus() {
  const [state, setState] = useState(STORAGE_HEALTH.checking);

  useEffect(() => {
    function handleStorageError() {
      setState(STORAGE_HEALTH.unavailable);
    }

    window.addEventListener('one:storage-error', handleStorageError);
    const storageAvailable = probeLocalStorage();
    const legacyCleanupSucceeded = storageAvailable && removeLegacyTaskData();

    if (storageAvailable && legacyCleanupSucceeded) {
      setState(STORAGE_HEALTH.available);
    } else {
      setState(STORAGE_HEALTH.unavailable);
      reportStorageHealthFailure();
    }

    return () => window.removeEventListener('one:storage-error', handleStorageError);
  }, []);

  return (
    <p className="hint" id="storage-health-status" role="status" aria-live="polite" data-state={state.state}>
      {state.text}
    </p>
  );
}
