export const TODO_STORAGE_KEY = 'one.todos.v2';
export const LEGACY_TODO_STORAGE_KEY = 'one.todos.v1';
export const TODO_RESET_BACKUP_KEY = 'one.todos.resetBackup.v1';

function readResetSnapshot(storage) {
  const raw = storage.getItem(TODO_RESET_BACKUP_KEY);
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  const current = typeof parsed?.current === 'string' ? parsed.current : null;
  const legacy = typeof parsed?.legacy === 'string' ? parsed.legacy : null;
  if (current === null && legacy === null) return null;

  return { current, legacy };
}

export function canRestoreTodoSchedule(storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    return readResetSnapshot(storage) !== null;
  } catch {
    return false;
  }
}

export function resetTodoSchedule(storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    const current = storage.getItem(TODO_STORAGE_KEY);
    const legacy = storage.getItem(LEGACY_TODO_STORAGE_KEY);

    if (current !== null || legacy !== null) {
      storage.setItem(TODO_RESET_BACKUP_KEY, JSON.stringify({ current, legacy }));
    }

    storage.removeItem(TODO_STORAGE_KEY);
    storage.removeItem(LEGACY_TODO_STORAGE_KEY);
    return storage.getItem(TODO_STORAGE_KEY) === null
      && storage.getItem(LEGACY_TODO_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

export function restoreTodoSchedule(storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    const snapshot = readResetSnapshot(storage);
    if (!snapshot) return false;

    if (snapshot.current === null) storage.removeItem(TODO_STORAGE_KEY);
    else storage.setItem(TODO_STORAGE_KEY, snapshot.current);

    if (snapshot.legacy === null) storage.removeItem(LEGACY_TODO_STORAGE_KEY);
    else storage.setItem(LEGACY_TODO_STORAGE_KEY, snapshot.legacy);

    storage.removeItem(TODO_RESET_BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}
