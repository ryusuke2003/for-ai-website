import { useEffect, useMemo, useState } from 'react';

const TODO_STORAGE_KEY = 'one.todos.v1';
const CARD_CLASS = 'card my-4 rounded-3xl border border-[var(--one-border)] bg-[var(--one-card)] p-7 shadow-[var(--one-card-shadow)] backdrop-blur-[14px] max-[560px]:rounded-[20px] max-[560px]:p-[22px]';

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function normalizeTodos(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((todo) => todo && typeof todo.id === 'string' && typeof todo.text === 'string')
    .map((todo) => ({
      id: todo.id,
      text: todo.text.trim().slice(0, 120),
      completed: todo.completed === true,
    }))
    .filter((todo) => todo.text.length > 0);
}

function readTodos() {
  try {
    const stored = localStorage.getItem(TODO_STORAGE_KEY);
    if (!stored) return [];
    return normalizeTodos(JSON.parse(stored));
  } catch {
    reportStorageFailure();
    return [];
  }
}

function writeTodos(todos) {
  try {
    const serialized = JSON.stringify(todos);
    localStorage.setItem(TODO_STORAGE_KEY, serialized);
    if (localStorage.getItem(TODO_STORAGE_KEY) === serialized) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

function createTodoId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function TodoPage() {
  const [todos, setTodos] = useState(readTodos);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    writeTodos(todos);
  }, [todos]);

  const remainingCount = useMemo(
    () => todos.filter((todo) => !todo.completed).length,
    [todos],
  );
  const completedCount = todos.length - remainingCount;

  function addTodo(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setTodos((current) => [
      ...current,
      { id: createTodoId(), text: text.slice(0, 120), completed: false },
    ]);
    setDraft('');
  }

  function toggleTodo(id) {
    setTodos((current) => current.map((todo) => (
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )));
  }

  function removeTodo(id) {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  function clearCompleted() {
    setTodos((current) => current.filter((todo) => !todo.completed));
  }

  return (
    <section className={`${CARD_CLASS} todo-card`} aria-labelledby="todo-title">
      <div className="mb-8">
        <p className="mb-2 text-[0.78rem] font-extrabold tracking-[0.12em] text-[var(--one-subtle)]">TODO</p>
        <h1 id="todo-title" className="m-0 text-[clamp(2rem,7vw,3.2rem)] font-black tracking-[-0.045em]">やること</h1>
        <p className="mb-0 mt-3 text-[0.9rem] font-semibold text-[var(--one-muted)]">
          {todos.length === 0
            ? '思いついたことをここに追加できます。'
            : remainingCount === 0
              ? '全部完了しています。'
              : `残り ${remainingCount}件`}
        </p>
      </div>

      <form className="mb-7 flex gap-2.5 max-[560px]:flex-col" onSubmit={addTodo}>
        <label className="sr-only" htmlFor="todo-input">やること</label>
        <input
          id="todo-input"
          className="min-w-0 flex-1 rounded-2xl border border-[var(--one-control-border-soft)] bg-[var(--one-input-bg)] px-4 py-3.5 font-semibold text-[var(--one-fg)] placeholder:text-[var(--one-muted)]"
          type="text"
          maxLength={120}
          autoComplete="off"
          placeholder="やることを入力"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          className="rounded-2xl border border-[var(--one-control-border)] bg-[var(--one-primary-bg)] px-5 py-3.5 font-extrabold text-[var(--one-primary-fg)] disabled:opacity-40"
          type="submit"
          disabled={draft.trim().length === 0}
        >
          追加
        </button>
      </form>

      {todos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--one-border)] px-5 py-10 text-center text-[0.9rem] font-semibold text-[var(--one-muted)]">
          まだTodoはありません。
        </div>
      ) : (
        <ul className="m-0 list-none space-y-2.5 p-0" aria-label="Todoリスト">
          {todos.map((todo) => (
            <li
              className="flex items-center gap-3 rounded-2xl border border-[var(--one-border-soft)] bg-[var(--one-stat-bg)] px-4 py-3.5"
              key={todo.id}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 font-semibold">
                <input
                  className="h-5 w-5 shrink-0 accent-[var(--one-fg)]"
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span className={`min-w-0 break-words ${todo.completed ? 'text-[var(--one-muted)] line-through' : ''}`}>
                  {todo.text}
                </span>
              </label>
              <button
                className="shrink-0 rounded-full border-0 bg-transparent px-2 py-1 text-[0.78rem] font-extrabold text-[var(--one-muted)] hover:text-[var(--one-fg)]"
                type="button"
                aria-label={`${todo.text}を削除`}
                onClick={() => removeTodo(todo.id)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      {completedCount > 0 ? (
        <div className="mt-5 flex justify-end">
          <button
            className="rounded-full border border-[var(--one-border)] bg-transparent px-4 py-2 text-[0.78rem] font-extrabold text-[var(--one-muted)] hover:border-[var(--one-border-strong)] hover:text-[var(--one-fg)]"
            type="button"
            onClick={clearCompleted}
          >
            完了済みを削除
          </button>
        </div>
      ) : null}
    </section>
  );
}
