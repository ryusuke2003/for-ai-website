const storageHealthStatus = document.querySelector('#storage-health-status');
const taskCharacterCount = document.querySelector('#task-character-count');
const STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1';
const TASK_STORAGE_FAILURE_MESSAGE = 'このタブでは入力を保持していますが、端末へ保存できませんでした。再読み込みすると内容が失われる可能性があります。';
const TASK_REMOTE_UPDATE_PENDING_MESSAGE = '別のタブで今日のタスクが更新されました。このタブでは編集中または集中セッション中の内容を維持しています。集中を終えるか入力欄を離れた後に最新状態を確認します。';
const TASK_REMOTE_UPDATE_APPLIED_MESSAGE = '別のタブで今日のタスクが更新されたため、このタブにも反映しました。';

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

function taskSyncBlocked() {
  return document.activeElement === taskInput || hasActiveDailyTaskContext();
}

function syncTaskFromStorage({ announce = true } = {}) {
  if (storageAccessFailed) return false;

  if (taskSyncBlocked()) {
    if (announce && taskStorageStatus.textContent !== TASK_REMOTE_UPDATE_PENDING_MESSAGE) {
      taskStorageStatus.textContent = TASK_REMOTE_UPDATE_PENDING_MESSAGE;
    }
    return false;
  }

  const storedTaskDate = safeRead(STORAGE_KEYS.taskDate);
  if (storageAccessFailed) return false;
  if (storedTaskDate !== dateKey()) return false;

  const storedTask = safeRead(STORAGE_KEYS.task);
  if (storageAccessFailed) return false;

  const maxLength = taskInput.maxLength > 0 ? taskInput.maxLength : 120;
  const nextTask = storedTask.slice(0, maxLength);
  const changed = taskInput.value !== nextTask;
  taskInput.value = nextTask;
  updateTaskCharacterCount();

  if (taskStorageStatus.textContent === TASK_REMOTE_UPDATE_PENDING_MESSAGE) {
    taskStorageStatus.textContent = announce && changed ? TASK_REMOTE_UPDATE_APPLIED_MESSAGE : '';
  } else if (announce && changed) {
    taskStorageStatus.textContent = TASK_REMOTE_UPDATE_APPLIED_MESSAGE;
  }

  return true;
}

function handleTaskInput() {
  if (
    !storageAccessFailed
    && (
      taskStorageStatus.textContent === TASK_REMOTE_UPDATE_PENDING_MESSAGE
      || taskStorageStatus.textContent === TASK_REMOTE_UPDATE_APPLIED_MESSAGE
    )
  ) {
    taskStorageStatus.textContent = '';
  }
  updateTaskCharacterCount();
  revealTaskStorageFailureIfNeeded();
}

window.addEventListener('one:storage-error', () => {
  setStorageHealth(false);
});

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEYS.task && event.key !== STORAGE_KEYS.taskDate) return;
  syncTaskFromStorage();
});

taskInput.addEventListener('input', handleTaskInput);
taskInput.addEventListener('focus', updateTaskCharacterCount);
taskInput.addEventListener('blur', () => {
  syncTaskFromStorage();
});
window.addEventListener('focus', () => {
  updateTaskCharacterCount();
  syncTaskFromStorage({ announce: false });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  updateTaskCharacterCount();
  syncTaskFromStorage({ announce: false });
});

[resetButton, doneButton, discardButton].forEach((button) => {
  button.addEventListener('click', () => {
    syncTaskFromStorage();
  });
});

updateTaskCharacterCount();
setStorageHealth(probeLocalStorage());
