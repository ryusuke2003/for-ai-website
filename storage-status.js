const storageHealthStatus = document.querySelector('#storage-health-status');
const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';

function setStorageHealth(available) {
  const usable = available === true;
  storageHealthStatus.dataset.state = usable ? 'available' : 'unavailable';
  storageHealthStatus.textContent = usable
    ? '端末保存: 利用できます。タスク・タイマー・集中記録はこのブラウザだけに保存されます。'
    : '⚠ 端末保存を利用できません。今の画面では使えますが、再読み込みするとタスク・タイマー・集中記録が消える可能性があります。';
}

function probeLocalStorage() {
  if (storageAccessFailed) return false;

  const token = `${Date.now()}-${Math.random()}`;
  try {
    localStorage.setItem(STORAGE_HEALTH_PROBE_KEY, token);
    const persisted = localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token;
    localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
    return persisted;
  } catch {
    try {
      localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY);
    } catch {
      // Ignore cleanup failure. The status below reports that storage is unavailable.
    }
    return false;
  }
}

window.addEventListener('one:storage-error', () => {
  setStorageHealth(false);
});

setStorageHealth(probeLocalStorage());
