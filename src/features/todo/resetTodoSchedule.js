export const TODO_STORAGE_KEY = 'one.todos.v2';
export const LEGACY_TODO_STORAGE_KEY = 'one.todos.v1';

export function resetTodoSchedule(storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    storage.removeItem(TODO_STORAGE_KEY);
    storage.removeItem(LEGACY_TODO_STORAGE_KEY);
    return storage.getItem(TODO_STORAGE_KEY) === null
      && storage.getItem(LEGACY_TODO_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}
