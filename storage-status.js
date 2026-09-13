const storageHealthStatus = document.querySelector('#storage-health-status');
const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';
const LEGACY_TASK_STORAGE_KEYS = ['one.task', 'one.taskDate.v1'];

function setStorageHealth(available) {
  const usable = available === true;
  storageHealthStatus.dataset.state = usable ? 'available' : 'unavailable';
  storageHealthStatus.textContent = usable
    ? '端末保存: 利用できます。タイマー・集中記録・設定はこのブラウザだけに保存されます。'
    : '⚠ 端末保存を利用できません。今の画面では使えますが、再読み込みするとタイマー・集中記録・設定が消える可能性があります。';
}

function probeLocalStorage() {
  if (storageAccessFailed) return false;

  const token = `${Date.now()}-${Math.random()}`;
  try {
    localStorage.setItem(STORAGE_HEALTH_PROBE_KEY, token);
    const persisted = localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token;
    if (!persisted) {
      reportStorageFailure();
      return false;
    }

    localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
    if (localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) !== null) {
      reportStorageFailure();
      return false;
    }
    return true;
  } catch {
    try {
      localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
    } catch {
      // Best-effort cleanup only. The storage failure is reported below.
    }
    reportStorageFailure();
    return false;
  }
}

function removeLegacyTaskData() {
  if (storageAccessFailed) return;

  try {
    LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    const removed = LEGACY_TASK_STORAGE_KEYS.every((key) => localStorage.getItem(key) === null);
    if (!removed) reportStorageFailure();
  } catch {
    reportStorageFailure();
  }
}

window.addEventListener('one:storage-error', () => {
  setStorageHealth(false);
});

const storageAvailable = probeLocalStorage();
setStorageHealth(storageAvailable);
if (storageAvailable) removeLegacyTaskData();
