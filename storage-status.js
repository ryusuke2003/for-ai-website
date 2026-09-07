const storageHealthStatus = document.querySelector('#storage-health-status');
const taskCharacterCount = document.querySelector('#task-character-count');
const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';
const TASK_STORAGE_FAILURE_MESSAGE = 'このタブでは入力を保持していますが、端末へ保存できませんでした。再読み込みすると内容が失われる可能性があります。';

const taskStorageStatus = document.createElement('p');
taskStorageStatus.className = 'hint';
taskStorageStatus.id = 'task-storage-status';
taskStorageStatus.setAttribute('role', 'status');
taskStorageStatus.setAttribute('aria-live', 'polite');
taskCharacterCount.after(taskStorageStatus);

const taskDescriptionIds = new Set(
  (taskInput.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean),
);
taskDescriptionIds.add(taskStorageStatus.id);
taskInput.setAttribute('aria-describedby', [...taskDescriptionIds].join(' '));

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

function updateTaskCharacterCount() {
  const maxLength = taskInput.maxLength > 0 ? taskInput.maxLength : 120;
  const remaining = Math.max(0, maxLength - taskInput.value.length);
  taskCharacterCount.textContent = `あと${remaining}文字`;
}

function revealTaskStorageFailureIfNeeded() {
  if (!storageAccessFailed) return;
  if (taskStorageStatus.textContent === TASK_STORAGE_FAILURE_MESSAGE) return;
  taskStorageStatus.textContent = TASK_STORAGE_FAILURE_MESSAGE;
}

function handleTaskInput() {
  updateTaskCharacterCount();
  revealTaskStorageFailureIfNeeded();
}

window.addEventListener('one:storage-error', () => {
  setStorageHealth(false);
});

taskInput.addEventListener('input', handleTaskInput);
taskInput.addEventListener('focus', updateTaskCharacterCount);
window.addEventListener('focus', updateTaskCharacterCount);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateTaskCharacterCount();
});

updateTaskCharacterCount();
setStorageHealth(probeLocalStorage());
