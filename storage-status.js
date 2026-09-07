const storageHealthStatus = document.querySelector('#storage-health-status');
const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';
const TASK_STORAGE_FAILURE_MESSAGE = 'このタブでは入力を保持していますが、端末へ保存できませんでした。再読み込みすると内容が失われる可能性があります。';

const taskStorageStatus = document.createElement('p');
taskStorageStatus.className = 'hint';
taskStorageStatus.id = 'task-storage-status';
taskStorageStatus.setAttribute('role', 'status');
taskStorageStatus.setAttribute('aria-live', 'polite');
taskInput.after(taskStorageStatus);
taskInput.setAttribute('aria-describedby', taskStorageStatus.id);

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

function revealTaskStorageFailureIfNeeded() {
  if (!storageAccessFailed) return;
  if (taskStorageStatus.textContent === TASK_STORAGE_FAILURE_MESSAGE) return;
  taskStorageStatus.textContent = TASK_STORAGE_FAILURE_MESSAGE;
}

window.addEventListener('one:storage-error', () => {
  setStorageHealth(false);
});

taskInput.addEventListener('input', revealTaskStorageFailureIfNeeded);

setStorageHealth(probeLocalStorage());
