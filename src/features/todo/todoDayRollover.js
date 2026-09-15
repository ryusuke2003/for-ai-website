import {
  LEGACY_TODO_STORAGE_KEY,
  TODO_RESET_BACKUP_KEY,
  TODO_STORAGE_KEY,
} from './resetTodoSchedule.js';

export const TODO_DAY_STORAGE_KEY = 'one.todos.day.v1';

export function todoDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rolloverTodoDayIfNeeded(
  storage = globalThis.localStorage,
  now = new Date(),
) {
  if (!storage) return false;

  try {
    const today = todoDayKey(now);
    const storedDay = storage.getItem(TODO_DAY_STORAGE_KEY);

    // First run after introducing date tracking: keep the current schedule so
    // the update itself never deletes a user's existing Todo list.
    if (storedDay === null) {
      storage.setItem(TODO_DAY_STORAGE_KEY, today);
      return false;
    }

    if (storedDay === today) return false;

    storage.removeItem(TODO_STORAGE_KEY);
    storage.removeItem(LEGACY_TODO_STORAGE_KEY);
    storage.removeItem(TODO_RESET_BACKUP_KEY);
    storage.setItem(TODO_DAY_STORAGE_KEY, today);
    return true;
  } catch {
    return false;
  }
}
