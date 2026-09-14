import { TODO_DAY_MINUTES } from './todoSchedule.js';

export const TODO_TIMELINE_MINUTE_STEP = 5;
export const TODO_TIMELINE_PX_PER_HOUR = 300;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function minuteFromTimelinePointer(clientY, timelineTop, duration) {
  const timelineHeight = 24 * TODO_TIMELINE_PX_PER_HOUR;
  const safeTimelineTop = Number.isFinite(timelineTop) ? timelineTop : 0;
  const safeClientY = Number.isFinite(clientY) ? clientY : safeTimelineTop;
  const y = clamp(safeClientY - safeTimelineTop, 0, timelineHeight);
  const rawMinute = (y / TODO_TIMELINE_PX_PER_HOUR) * 60;
  const snappedMinute = Math.round(rawMinute / TODO_TIMELINE_MINUTE_STEP) * TODO_TIMELINE_MINUTE_STEP;
  return clamp(snappedMinute, 0, TODO_DAY_MINUTES - duration);
}

export function formatTimelineMinute(value) {
  if (value >= TODO_DAY_MINUTES) return '24:00';
  const minutes = clamp(value, 0, TODO_DAY_MINUTES - 1);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function buildDropTimePreview(startMinute, duration) {
  return {
    range: `${formatTimelineMinute(startMinute)}–${formatTimelineMinute(startMinute + duration)}`,
    top: (startMinute / 60) * TODO_TIMELINE_PX_PER_HOUR + 2,
    height: Math.max(24, (duration / 60) * TODO_TIMELINE_PX_PER_HOUR - 4),
  };
}

export function initialTimelineAnchorMinute(todos, currentMinute) {
  const nextIncompleteTodo = [...todos]
    .filter((todo) => !todo.completed && todo.startMinute + todo.duration > currentMinute)
    .sort((left, right) => left.startMinute - right.startMinute)[0];

  if (!nextIncompleteTodo || nextIncompleteTodo.startMinute <= currentMinute) return currentMinute;
  return nextIncompleteTodo.startMinute;
}
