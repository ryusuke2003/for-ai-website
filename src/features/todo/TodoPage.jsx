import { useEffect, useMemo, useRef, useState } from 'react';
import { placeTodoWithoutOverlap } from './todoSchedule.js';

const TODO_STORAGE_KEY = 'one.todos.v2';
const LEGACY_TODO_STORAGE_KEY = 'one.todos.v1';
const TEMPLATE_STORAGE_KEY = 'one.todoTemplates.v1';
const DRAG_MIME = 'application/x-one-todo';
const MINUTE_STEP = 5;
const DAY_MINUTES = 24 * 60;
const PX_PER_HOUR = 300;
const TIMELINE_HEIGHT = 24 * PX_PER_HOUR;
const CARD_CLASS = 'card my-4 rounded-3xl border border-[var(--one-border)] bg-[var(--one-card)] p-7 shadow-[var(--one-card-shadow)] backdrop-blur-[14px] max-[560px]:rounded-[20px] max-[560px]:p-[22px]';
const SUBCARD_CLASS = 'rounded-3xl border border-[var(--one-border)] bg-[var(--one-stat-bg)] p-5 max-[560px]:rounded-[20px] max-[560px]:p-4';
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * MINUTE_STEP);
const DURATIONS = Array.from({ length: 36 }, (_, index) => (index + 1) * MINUTE_STEP);
const TIMELINE_MARKS = Array.from({ length: 49 }, (_, index) => index * 30);

function reportStorageFailure() {
  window.dispatchEvent(new Event('one:storage-error'));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapMinutes(value) {
  return Math.round(value / MINUTE_STEP) * MINUTE_STEP;
}

function normalizeDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 25;
  return clamp(snapMinutes(numeric), MINUTE_STEP, 180);
}

function normalizeStartMinute(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(snapMinutes(numeric), 0, DAY_MINUTES - MINUTE_STEP);
}

function defaultStartMinute() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return clamp(Math.ceil(minutes / MINUTE_STEP) * MINUTE_STEP, 0, DAY_MINUTES - MINUTE_STEP);
}

function normalizeTodos(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((todo) => todo && typeof todo.id === 'string' && typeof todo.text === 'string')
    .map((todo, index) => {
      const duration = normalizeDuration(todo.duration);
      const fallbackStart = clamp(9 * 60 + index * 30, 0, DAY_MINUTES - duration);
      const startMinute = clamp(
        normalizeStartMinute(todo.startMinute, fallbackStart),
        0,
        DAY_MINUTES - duration,
      );

      return {
        id: todo.id,
        text: todo.text.trim().slice(0, 120),
        completed: todo.completed === true,
        startMinute,
        duration,
      };
    })
    .filter((todo) => todo.text.length > 0);
}

function normalizeTemplates(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((template) => template && typeof template.id === 'string' && typeof template.text === 'string')
    .map((template) => ({
      id: template.id,
      text: template.text.trim().slice(0, 120),
      duration: normalizeDuration(template.duration),
    }))
    .filter((template) => template.text.length > 0);
}

function readStoredArray(key, normalizer) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return normalizer(JSON.parse(stored));
  } catch {
    reportStorageFailure();
    return [];
  }
}

function readTodos() {
  const current = readStoredArray(TODO_STORAGE_KEY, normalizeTodos);
  if (current !== null) return current;

  const legacy = readStoredArray(LEGACY_TODO_STORAGE_KEY, normalizeTodos);
  return legacy ?? [];
}

function readTemplates() {
  return readStoredArray(TEMPLATE_STORAGE_KEY, normalizeTemplates) ?? [];
}

function writeStoredArray(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    if (localStorage.getItem(key) === serialized) return true;
  } catch {
    reportStorageFailure();
    return false;
  }

  reportStorageFailure();
  return false;
}

function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMinuteOfDay(value) {
  if (value >= DAY_MINUTES) return '24:00';
  const minutes = clamp(value, 0, DAY_MINUTES - 1);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dayLabel() {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
}

function dragPayload(event, payload) {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;

  const serialized = JSON.stringify(payload);
  dataTransfer.effectAllowed = payload.kind === 'task' ? 'move' : 'copy';
  dataTransfer.setData('text/plain', serialized);

  try {
    dataTransfer.setData(DRAG_MIME, serialized);
  } catch {
    // text/plain is intentionally kept as the cross-browser fallback.
  }
}

function parseDragPayload(dataTransfer) {
  const raw = dataTransfer.getData(DRAG_MIME) || dataTransfer.getData('text/plain');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function WheelSelect({ label, value, options, onChange, format = String }) {
  const currentIndex = Math.max(0, options.indexOf(value));
  const previous = options[(currentIndex - 1 + options.length) % options.length];
  const next = options[(currentIndex + 1) % options.length];

  function move(offset) {
    const nextIndex = (currentIndex + offset + options.length) % options.length;
    onChange(options[nextIndex]);
  }

  function handleWheel(event) {
    if (event.deltaY === 0) return;
    event.preventDefault();
    move(event.deltaY > 0 ? 1 : -1);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    }
  }

  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[0.7rem] font-extrabold tracking-[0.08em] text-[var(--one-subtle)]">{label}</span>
      <div
        className="grid min-h-[126px] select-none grid-rows-[1fr_auto_1fr] items-center rounded-2xl border border-[var(--one-control-border-soft)] bg-[var(--one-input-bg)] px-3 py-2 text-center outline-none transition-[border-color,background] hover:border-[var(--one-border-strong)] focus-visible:border-[var(--one-control-border)]"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        <button className="border-0 bg-transparent py-1 text-[0.72rem] font-bold text-[var(--one-muted)]" type="button" tabIndex={-1} aria-label={`${label}を戻す`} onClick={() => move(-1)}>
          {format(previous)}
        </button>
        <strong className="text-[1.25rem] tracking-[-0.02em]">{format(value)}</strong>
        <button className="border-0 bg-transparent py-1 text-[0.72rem] font-bold text-[var(--one-muted)]" type="button" tabIndex={-1} aria-label={`${label}を進める`} onClick={() => move(1)}>
          {format(next)}
        </button>
      </div>
    </div>
  );
}

function TimeAndDurationPicker({ startMinute, duration, onStartMinuteChange, onDurationChange }) {
  const hour = Math.floor(startMinute / 60);
  const minute = startMinute % 60;

  return (
    <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-2.5 max-[560px]:grid-cols-3">
      <WheelSelect
        label="開始・時"
        value={hour}
        options={HOURS}
        format={(value) => `${String(value).padStart(2, '0')}時`}
        onChange={(nextHour) => onStartMinuteChange(nextHour * 60 + minute)}
      />
      <WheelSelect
        label="開始・分"
        value={minute}
        options={MINUTES}
        format={(value) => `${String(value).padStart(2, '0')}分`}
        onChange={(nextMinute) => onStartMinuteChange(hour * 60 + nextMinute)}
      />
      <WheelSelect
        label="かかる時間"
        value={duration}
        options={DURATIONS}
        format={(value) => `${value}分`}
        onChange={onDurationChange}
      />
    </div>
  );
}

function TodoComposer({ draft, setDraft, startMinute, setStartMinute, duration, setDuration, onAdd }) {
  function handleSubmit(event) {
    event.preventDefault();
    onAdd();
  }

  return (
    <div className={SUBCARD_CLASS}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="m-0 text-[0.72rem] font-extrabold tracking-[0.1em] text-[var(--one-subtle)]">NEW TASK</p>
          <h2 className="mb-0 mt-1 text-[1.05rem]">予定をつくる</h2>
        </div>
        <span className="text-[0.74rem] font-bold text-[var(--one-muted)]">ホイール / ↑↓ で時間変更</span>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="sr-only" htmlFor="todo-input">やること</label>
          <input
            id="todo-input"
            className="w-full rounded-2xl border border-[var(--one-control-border-soft)] bg-[var(--one-input-bg)] px-4 py-3.5 font-semibold text-[var(--one-fg)] placeholder:text-[var(--one-muted)]"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="やることを入力"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>

        <TimeAndDurationPicker
          startMinute={startMinute}
          duration={duration}
          onStartMinuteChange={setStartMinute}
          onDurationChange={setDuration}
        />

        <div className="flex items-stretch gap-2.5 max-[560px]:flex-col">
          <button
            className="rounded-2xl border border-[var(--one-control-border)] bg-[var(--one-primary-bg)] px-5 py-3 font-extrabold text-[var(--one-primary-fg)] disabled:opacity-40"
            type="submit"
            disabled={draft.trim().length === 0}
          >
            {formatMinuteOfDay(startMinute)} に追加
          </button>
          <div
            className={`flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--one-border-strong)] px-4 py-3 text-center text-[0.76rem] font-extrabold ${draft.trim() ? 'cursor-grab text-[var(--one-fg)] active:cursor-grabbing' : 'text-[var(--one-muted)] opacity-50'}`}
            draggable={draft.trim().length > 0}
            onDragStart={(event) => dragPayload(event, { kind: 'draft' })}
          >
            {draft.trim() ? 'このタスクをタイムラインへドラッグ' : '入力するとドラッグできます'}
          </div>
        </div>
      </form>
    </div>
  );
}

function TemplatePanel({ templates, setTemplates, onUseTemplate }) {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(25);

  function saveTemplate(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setTemplates((current) => [
      ...current,
      { id: createId(), text: trimmed.slice(0, 120), duration },
    ]);
    setText('');
  }

  function removeTemplate(id) {
    setTemplates((current) => current.filter((template) => template.id !== id));
  }

  return (
    <aside className={SUBCARD_CLASS} aria-labelledby="template-title">
      <div className="mb-4">
        <p className="m-0 text-[0.72rem] font-extrabold tracking-[0.1em] text-[var(--one-subtle)]">TEMPLATE</p>
        <h2 id="template-title" className="mb-1 mt-1 text-[1.05rem]">テンプレート</h2>
        <p className="m-0 text-[0.76rem] font-semibold leading-relaxed text-[var(--one-muted)]">よく使うタスク名とかかる時間を保存。カードを予定表へドラッグできます。</p>
      </div>

      <form className="space-y-3" onSubmit={saveTemplate}>
        <label className="sr-only" htmlFor="template-input">テンプレート名</label>
        <input
          id="template-input"
          className="w-full rounded-2xl border border-[var(--one-control-border-soft)] bg-[var(--one-input-bg)] px-3.5 py-3 text-[0.88rem] font-semibold text-[var(--one-fg)] placeholder:text-[var(--one-muted)]"
          type="text"
          maxLength={120}
          autoComplete="off"
          placeholder="例: セキスペ 暗記問題"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <WheelSelect
          label="テンプレートの所要時間"
          value={duration}
          options={DURATIONS}
          format={(value) => `${value}分`}
          onChange={setDuration}
        />
        <button className="w-full rounded-2xl border border-[var(--one-control-border)] bg-transparent px-4 py-2.5 text-[0.82rem] font-extrabold text-[var(--one-fg)] disabled:opacity-40" type="submit" disabled={text.trim().length === 0}>
          テンプレートを保存
        </button>
      </form>

      <div className="mt-5 space-y-2.5" aria-label="保存したテンプレート">
        {templates.length === 0 ? (
          <p className="m-0 rounded-2xl border border-dashed border-[var(--one-border)] px-3 py-5 text-center text-[0.76rem] font-semibold text-[var(--one-muted)]">まだテンプレートはありません。</p>
        ) : templates.map((template) => (
          <div
            className="group flex cursor-grab items-center gap-2 rounded-2xl border border-[var(--one-border)] bg-[var(--one-card)] p-3 active:cursor-grabbing"
            key={template.id}
            draggable
            aria-label={`${template.text}テンプレートをドラッグ`}
            onDragStart={(event) => dragPayload(event, { kind: 'template', id: template.id })}
          >
            <div className="min-w-0 flex-1 select-none">
              <strong className="block truncate text-[0.86rem]">{template.text}</strong>
              <span className="mt-0.5 block text-[0.72rem] font-bold text-[var(--one-muted)]">{template.duration}分 · ドラッグして時間割へ</span>
            </div>
            <span className="shrink-0 select-none text-[0.72rem] font-bold text-[var(--one-muted)]" aria-hidden="true">⋮⋮</span>
            <button
              className="shrink-0 rounded-full border border-[var(--one-border)] bg-transparent px-2 py-1 text-[0.7rem] font-extrabold text-[var(--one-muted)] hover:border-[var(--one-border-strong)] hover:text-[var(--one-fg)]"
              type="button"
              aria-label={`${template.text}を入力欄で使う`}
              draggable={false}
              onClick={() => onUseTemplate(template)}
            >
              使う
            </button>
            <button
              className="shrink-0 rounded-full border-0 bg-transparent px-2 py-1 text-[0.7rem] font-extrabold text-[var(--one-muted)] opacity-60 hover:text-[var(--one-fg)] group-hover:opacity-100"
              type="button"
              aria-label={`${template.text}テンプレートを削除`}
              draggable={false}
              onClick={() => removeTemplate(template.id)}
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function TimelineTask({ todo, onToggle, onRemove, onDragStart }) {
  const top = (todo.startMinute / 60) * PX_PER_HOUR;
  const naturalHeight = (todo.duration / 60) * PX_PER_HOUR;
  const compact = todo.duration === MINUTE_STEP;
  const height = Math.max(24, naturalHeight - 4);
  const timeRange = `${formatMinuteOfDay(todo.startMinute)}–${formatMinuteOfDay(todo.startMinute + todo.duration)}`;

  return (
    <article
      className={`absolute left-[72px] right-3 z-10 cursor-grab overflow-hidden rounded-2xl border border-[var(--one-border-strong)] bg-[var(--one-card)] px-3 ${compact ? 'py-0.5' : 'py-2'} shadow-[var(--one-card-shadow)] active:cursor-grabbing ${todo.completed ? 'opacity-55' : ''}`}
      style={{ top: `${top + 2}px`, height: `${height}px` }}
      draggable
      onDragStart={onDragStart}
      aria-label={`${formatMinuteOfDay(todo.startMinute)} ${todo.text}`}
    >
      <div className="flex h-full min-w-0 items-center gap-2.5">
        <input
          className="h-4 w-4 shrink-0 accent-[var(--one-fg)]"
          type="checkbox"
          checked={todo.completed}
          aria-label={`${todo.text}を完了`}
          onChange={onToggle}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <strong className={`min-w-0 truncate text-[0.84rem] ${todo.completed ? 'line-through' : ''}`}>{todo.text}</strong>
          <span className="shrink-0 text-[0.72rem] font-bold text-[var(--one-muted)]" data-testid={`todo-time-range-${todo.id}`}>
            {timeRange}
          </span>
        </div>
        <span className="shrink-0 text-[0.68rem] font-bold text-[var(--one-muted)]" aria-hidden="true">⋮⋮</span>
        <button className="shrink-0 rounded-full border-0 bg-transparent px-1.5 py-1 text-[0.68rem] font-extrabold text-[var(--one-muted)] hover:text-[var(--one-fg)]" type="button" aria-label={`${todo.text}を削除`} onClick={onRemove}>
          削除
        </button>
      </div>
    </article>
  );
}

function DailyTimeline({ todos, templates, draft, draftDuration, onCreateAt, onMoveTask, onToggle, onRemove }) {
  const viewportRef = useRef(null);
  const currentMinute = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const firstMinute = todos[0]?.startMinute ?? currentMinute;
    viewport.scrollTop = Math.max(0, ((firstMinute - 60) / 60) * PX_PER_HOUR);
  }, []);

  function minuteFromDrop(event, duration) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = clamp(event.clientY - rect.top, 0, TIMELINE_HEIGHT);
    const minute = snapMinutes((y / PX_PER_HOUR) * 60);
    return clamp(minute, 0, DAY_MINUTES - duration);
  }

  function handleDrop(event) {
    event.preventDefault();
    const payload = parseDragPayload(event.dataTransfer);
    if (!payload) return;

    if (payload.kind === 'task') {
      const task = todos.find((todo) => todo.id === payload.id);
      if (!task) return;
      onMoveTask(task.id, minuteFromDrop(event, task.duration));
      return;
    }

    if (payload.kind === 'template') {
      const template = templates.find((item) => item.id === payload.id);
      if (!template) return;
      onCreateAt(template.text, template.duration, minuteFromDrop(event, template.duration), 'template');
      return;
    }

    if (payload.kind === 'draft' && draft.trim()) {
      onCreateAt(draft, draftDuration, minuteFromDrop(event, draftDuration), 'draft');
    }
  }

  return (
    <section className={SUBCARD_CLASS} aria-labelledby="timeline-title">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="m-0 text-[0.72rem] font-extrabold tracking-[0.1em] text-[var(--one-subtle)]">TODAY</p>
          <h2 id="timeline-title" className="mb-0 mt-1 text-[1.05rem]">今日の時間割</h2>
        </div>
        <span className="text-[0.74rem] font-bold text-[var(--one-muted)]">{dayLabel()}</span>
      </div>

      <p className="mb-3 mt-0 text-[0.76rem] font-semibold text-[var(--one-muted)]">タスクやテンプレートをドラッグすると5分刻みで配置できます。重なる場合は、操作中ではない予定をドラッグ方向へ連鎖的に押し出します。</p>

      <div ref={viewportRef} className="h-[610px] overflow-y-auto rounded-2xl border border-[var(--one-border)] bg-[var(--one-input-bg)] max-[560px]:h-[520px]">
        <div
          className="relative"
          style={{ height: `${TIMELINE_HEIGHT}px` }}
          data-testid="todo-timeline"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy';
          }}
          onDrop={handleDrop}
        >
          {TIMELINE_MARKS.map((minute) => {
            const top = (minute / 60) * PX_PER_HOUR;
            const hourMark = minute % 60 === 0;
            return (
              <div className="absolute left-0 right-0" key={minute} style={{ top: `${top}px` }} aria-hidden="true">
                <span className={`absolute left-3 -translate-y-1/2 text-[0.68rem] font-bold ${hourMark ? 'text-[var(--one-subtle)]' : 'text-[var(--one-muted)] opacity-50'}`}>
                  {formatMinuteOfDay(minute)}
                </span>
                <span className={`absolute left-[62px] right-0 border-t ${hourMark ? 'border-[var(--one-border)]' : 'border-dashed border-[var(--one-border-soft)]'}`} />
              </div>
            );
          })}

          <div className="pointer-events-none absolute left-[62px] right-0 z-[5] border-t-2 border-[var(--one-fg)] opacity-20" style={{ top: `${(currentMinute / 60) * PX_PER_HOUR}px` }} aria-hidden="true" />

          {todos.map((todo) => (
            <TimelineTask
              key={todo.id}
              todo={todo}
              onToggle={() => onToggle(todo.id)}
              onRemove={() => onRemove(todo.id)}
              onDragStart={(event) => dragPayload(event, { kind: 'task', id: todo.id })}
            />
          ))}

          {todos.length === 0 ? (
            <div className="pointer-events-none sticky top-5 z-20 mx-auto mt-5 w-[calc(100%-100px)] rounded-2xl border border-dashed border-[var(--one-border-strong)] bg-[var(--one-card)] px-4 py-3 text-center text-[0.76rem] font-bold text-[var(--one-muted)]">
              ここへタスクをドラッグして予定を作れます。
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function TodoPage() {
  const [todos, setTodos] = useState(readTodos);
  const [templates, setTemplates] = useState(readTemplates);
  const [draft, setDraft] = useState('');
  const [startMinute, setStartMinute] = useState(defaultStartMinute);
  const [duration, setDuration] = useState(25);

  useEffect(() => {
    writeStoredArray(TODO_STORAGE_KEY, todos);
  }, [todos]);

  useEffect(() => {
    writeStoredArray(TEMPLATE_STORAGE_KEY, templates);
  }, [templates]);

  const sortedTodos = useMemo(
    () => [...todos].sort((left, right) => left.startMinute - right.startMinute || left.id.localeCompare(right.id)),
    [todos],
  );
  const remainingCount = sortedTodos.filter((todo) => !todo.completed).length;
  const completedCount = sortedTodos.length - remainingCount;

  function addTodo(text = draft, taskDuration = duration, taskStartMinute = startMinute) {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const normalizedDuration = normalizeDuration(taskDuration);
    const normalizedStart = clamp(
      normalizeStartMinute(taskStartMinute, startMinute),
      0,
      DAY_MINUTES - normalizedDuration,
    );
    const candidate = {
      id: createId(),
      text: trimmed.slice(0, 120),
      completed: false,
      startMinute: normalizedStart,
      duration: normalizedDuration,
    };
    const placed = placeTodoWithoutOverlap(todos, candidate, normalizedStart, 'forward');
    if (!placed) return false;

    setTodos(placed);
    setDraft('');
    setStartMinute(clamp(normalizedStart + normalizedDuration, 0, DAY_MINUTES - MINUTE_STEP));
    return true;
  }

  function createFromDrop(text, taskDuration, taskStartMinute, source) {
    const added = addTodo(text, taskDuration, taskStartMinute);
    if (!added || source !== 'draft') return;
    setDuration(taskDuration);
  }

  function useTemplate(template) {
    setDraft(template.text);
    setDuration(template.duration);
    document.querySelector('#todo-input')?.focus();
  }

  function moveTodo(id, nextStartMinute) {
    const task = todos.find((todo) => todo.id === id);
    if (!task) return false;

    const normalizedStart = clamp(nextStartMinute, 0, DAY_MINUTES - task.duration);
    const direction = normalizedStart < task.startMinute ? 'backward' : 'forward';
    const placed = placeTodoWithoutOverlap(todos, task, normalizedStart, direction);
    if (!placed) return false;

    setTodos(placed);
    return true;
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
      <div className="mb-7 flex items-end justify-between gap-5 max-[560px]:items-start">
        <div>
          <p className="mb-2 text-[0.78rem] font-extrabold tracking-[0.12em] text-[var(--one-subtle)]">TODO</p>
          <h1 id="todo-title" className="m-0 text-[clamp(2rem,7vw,3.2rem)] font-black tracking-[-0.045em]">今日を組み立てる</h1>
          <p className="mb-0 mt-3 text-[0.9rem] font-semibold text-[var(--one-muted)]">
            {sortedTodos.length === 0
              ? '時間を決めて追加するか、タスクを予定表へドラッグできます。'
              : remainingCount === 0
                ? '今日の予定は全部完了しています。'
                : `残り ${remainingCount}件 · ${sortedTodos.length}件中`}
          </p>
        </div>
        {completedCount > 0 ? (
          <button className="shrink-0 rounded-full border border-[var(--one-border)] bg-transparent px-4 py-2 text-[0.76rem] font-extrabold text-[var(--one-muted)] hover:border-[var(--one-border-strong)] hover:text-[var(--one-fg)]" type="button" onClick={clearCompleted}>
            完了済みを削除
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 max-[820px]:grid-cols-1">
        <div className="space-y-4">
          <TodoComposer
            draft={draft}
            setDraft={setDraft}
            startMinute={startMinute}
            setStartMinute={setStartMinute}
            duration={duration}
            setDuration={setDuration}
            onAdd={() => addTodo()}
          />
          <DailyTimeline
            todos={sortedTodos}
            templates={templates}
            draft={draft}
            draftDuration={duration}
            onCreateAt={createFromDrop}
            onMoveTask={moveTodo}
            onToggle={toggleTodo}
            onRemove={removeTodo}
          />
        </div>

        <TemplatePanel templates={templates} setTemplates={setTemplates} onUseTemplate={useTemplate} />
      </div>
    </section>
  );
}