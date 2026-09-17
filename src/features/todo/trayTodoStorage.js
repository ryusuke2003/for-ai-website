import {
  LEGACY_TODO_STORAGE_KEY,
  TODO_STORAGE_KEY,
} from './resetTodoSchedule.js';
import { rolloverTodoDayIfNeeded } from './todoDayRollover.js';

export function readTrayTodos(
  storage = globalThis.localStorage,
  now = new Date(),
) {
  if (!storage) return [];

  rolloverTodoDayIfNeeded(storage, now);

  try {
    const raw = storage.getItem(TODO_STORAGE_KEY) ?? storage.getItem(LEGACY_TODO_STORAGE_KEY);
    if (!raw) return [];

    return JSON.parse(raw)
      .filter((todo) => todo && typeof todo.id === 'string' && typeof todo.text === 'string')
      .map((todo) => ({
        ...todo,
        completed: todo.completed === true,
        startMinute: Number(todo.startMinute) || 0,
        duration: Math.max(5, Number(todo.duration) || 25),
      }))
      .sort((left, right) => left.startMinute - right.startMinute || left.id.localeCompare(right.id));
  } catch {
    return [];
  }
}
