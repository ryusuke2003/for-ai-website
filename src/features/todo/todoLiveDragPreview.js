import { placeTodoWithoutOverlap } from './todoSchedule.js';
import {
  buildDropTimePreview,
  minuteFromTimelinePointer,
  TODO_TIMELINE_PX_PER_HOUR,
} from './todoTimelinePosition.js';

const TIMELINE_SELECTOR = '[data-testid="todo-timeline"]';
const TIME_RANGE_PREFIX = 'todo-time-range-';
const DAY_MINUTES = 24 * 60;
const PREVIEW_TRANSITION = 'transform 120ms ease';

let started = false;
let activeDrag = null;
let previewedElements = new Set();
let dropTimePreview = null;

function parseClock(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute >= 60) return null;
  if (hour === 24 && minute === 0) return DAY_MINUTES;
  if (hour < 0 || hour >= 24) return null;
  return hour * 60 + minute;
}

function taskFromArticle(article) {
  const range = article.querySelector(`[data-testid^="${TIME_RANGE_PREFIX}"]`);
  if (!range) return null;

  const testId = range.getAttribute('data-testid') ?? '';
  const id = testId.slice(TIME_RANGE_PREFIX.length);
  const [startText, endText] = range.textContent.split('–');
  const startMinute = parseClock(startText);
  const endMinute = parseClock(endText);
  if (!id || startMinute === null || endMinute === null || endMinute <= startMinute) return null;

  return {
    id,
    startMinute,
    duration: endMinute - startMinute,
  };
}

function timelineEntries(timeline) {
  return [...timeline.querySelectorAll('article[draggable="true"]')]
    .map((article) => {
      const todo = taskFromArticle(article);
      return todo ? { article, todo } : null;
    })
    .filter(Boolean);
}

function templateDuration(source) {
  const match = source.textContent.match(/(\d+)分/);
  return match ? Number(match[1]) : null;
}

function draftDuration(source) {
  const container = source.closest('.card, [class*="rounded-3xl"]') ?? source.parentElement;
  const picker = container?.querySelector('[role="spinbutton"][aria-label="かかる時間"]');
  const value = Number(picker?.getAttribute('aria-valuenow'));
  return Number.isInteger(value) ? value : null;
}

function dragContextFromSource(source, timeline) {
  const article = source.closest('article[draggable="true"]');
  if (article && timeline?.contains(article)) {
    const todo = taskFromArticle(article);
    return todo ? { kind: 'task', id: todo.id, duration: todo.duration, originalStartMinute: todo.startMinute } : null;
  }

  const template = source.closest('[aria-label$="テンプレートをドラッグ"]');
  if (template) {
    const duration = templateDuration(template);
    return Number.isInteger(duration) ? { kind: 'new', id: '__todo-live-preview__', duration } : null;
  }

  const draft = source.closest('[draggable="true"]');
  if (draft?.textContent.includes('このタスクをタイムラインへドラッグ')) {
    const duration = draftDuration(draft);
    return Number.isInteger(duration) ? { kind: 'new', id: '__todo-live-preview__', duration } : null;
  }

  return null;
}

export function buildLivePreviewSchedule(todos, candidate, desiredStartMinute) {
  const existing = candidate.kind === 'task'
    ? todos.find((todo) => todo.id === candidate.id)
    : null;
  const previewCandidate = existing ?? {
    id: candidate.id,
    startMinute: desiredStartMinute,
    duration: candidate.duration,
  };
  if (!previewCandidate) return null;

  const direction = candidate.kind === 'task' && desiredStartMinute < candidate.originalStartMinute
    ? 'backward'
    : 'forward';

  return placeTodoWithoutOverlap(todos, previewCandidate, desiredStartMinute, direction);
}

function resetTaskPreview() {
  for (const element of previewedElements) {
    element.style.transform = '';
  }
  previewedElements = new Set();
}

function resetPreview() {
  resetTaskPreview();
  dropTimePreview?.remove();
  dropTimePreview = null;
}

function desiredStartMinute(event, timeline, duration) {
  const rect = timeline.getBoundingClientRect();
  return minuteFromTimelinePointer(event.clientY, rect.top, duration);
}

function showDropTimePreview(timeline, startMinute, duration, canPlace) {
  const preview = buildDropTimePreview(startMinute, duration);
  if (!dropTimePreview || dropTimePreview.parentElement !== timeline) {
    dropTimePreview?.remove();
    dropTimePreview = document.createElement('div');
    dropTimePreview.className = 'pointer-events-none absolute left-[72px] right-3 z-30 rounded-2xl border-2 border-dashed border-[var(--one-control-border)] bg-[var(--one-active-bg)] px-2 py-1 shadow-[var(--one-card-shadow)]';
    dropTimePreview.dataset.testid = 'todo-drop-time-preview';
    dropTimePreview.setAttribute('role', 'status');
    dropTimePreview.setAttribute('aria-live', 'polite');

    const label = document.createElement('span');
    label.className = 'inline-flex whitespace-nowrap rounded-full bg-[var(--one-primary-bg)] px-2 py-1 text-[0.72rem] font-extrabold leading-none text-[var(--one-primary-fg)]';
    dropTimePreview.append(label);
    timeline.append(dropTimePreview);
  }

  const indicator = dropTimePreview;
  indicator.style.top = `${preview.top}px`;
  indicator.style.height = `${preview.height}px`;
  indicator.style.opacity = canPlace ? '0.92' : '0.6';

  const label = indicator.firstElementChild;
  const nextLabel = canPlace ? `ここで離すと ${preview.range}` : 'この位置には配置できません';
  if (label.textContent !== nextLabel) label.textContent = nextLabel;
}

function applyPreview(timeline, event) {
  if (!activeDrag) return;

  const entries = timelineEntries(timeline);
  const todos = entries.map(({ todo }) => todo);
  const desiredStart = desiredStartMinute(event, timeline, activeDrag.duration);
  const preview = buildLivePreviewSchedule(todos, activeDrag, desiredStart);

  resetTaskPreview();
  showDropTimePreview(timeline, desiredStart, activeDrag.duration, Boolean(preview));
  if (!preview) return;

  const previewById = new Map(preview.map((todo) => [todo.id, todo]));
  for (const { article, todo } of entries) {
    if (activeDrag.kind === 'task' && todo.id === activeDrag.id) continue;
    const next = previewById.get(todo.id);
    if (!next || next.startMinute === todo.startMinute) continue;

    const offset = ((next.startMinute - todo.startMinute) / 60) * TODO_TIMELINE_PX_PER_HOUR;
    article.style.transition = PREVIEW_TRANSITION;
    article.style.transform = `translateY(${offset}px)`;
    previewedElements.add(article);
  }
}

function resetAfterDrop() {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => resetPreview());
    return;
  }
  resetPreview();
}

export function startTodoLiveDragPreview() {
  if (started || typeof document === 'undefined') return;
  started = true;

  document.addEventListener('dragstart', (event) => {
    const source = event.target instanceof Element ? event.target : null;
    if (!source) return;
    const timeline = document.querySelector(TIMELINE_SELECTOR);
    activeDrag = dragContextFromSource(source, timeline);
  });

  document.addEventListener('dragover', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const timeline = target?.closest(TIMELINE_SELECTOR);
    if (!timeline) {
      resetPreview();
      return;
    }
    applyPreview(timeline, event);
  });

  document.addEventListener('drop', () => {
    activeDrag = null;
    resetAfterDrop();
  });

  document.addEventListener('dragend', () => {
    activeDrag = null;
    resetAfterDrop();
  });
}
