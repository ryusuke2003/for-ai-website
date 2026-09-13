export const TODO_DAY_MINUTES = 24 * 60;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function endMinute(todo) {
  return todo.startMinute + todo.duration;
}

/**
 * Place one task at the requested time and push colliding tasks in the same
 * direction. The actively moved task always keeps the requested position.
 *
 * Returns null when the cascade would leave the current day.
 */
export function placeTodoWithoutOverlap(todos, candidate, desiredStartMinute, direction = 'forward') {
  const maxStart = TODO_DAY_MINUTES - candidate.duration;
  const target = {
    ...candidate,
    startMinute: clamp(desiredStartMinute, 0, maxStart),
  };
  const others = todos.filter((todo) => todo.id !== candidate.id);
  const updates = new Map();

  if (direction === 'backward') {
    let boundary = target.startMinute;
    const targetEnd = endMinute(target);
    const ordered = [...others].sort((left, right) => (
      right.startMinute - left.startMinute || right.id.localeCompare(left.id)
    ));

    for (const todo of ordered) {
      const todoEnd = endMinute(todo);
      if (todo.startMinute >= targetEnd || todoEnd <= boundary) continue;

      const nextStart = boundary - todo.duration;
      if (nextStart < 0) return null;
      updates.set(todo.id, nextStart);
      boundary = nextStart;
    }
  } else {
    let boundary = endMinute(target);
    const targetStart = target.startMinute;
    const ordered = [...others].sort((left, right) => (
      left.startMinute - right.startMinute || left.id.localeCompare(right.id)
    ));

    for (const todo of ordered) {
      const todoEnd = endMinute(todo);
      if (todoEnd <= targetStart || todo.startMinute >= boundary) continue;

      const nextStart = boundary;
      if (nextStart + todo.duration > TODO_DAY_MINUTES) return null;
      updates.set(todo.id, nextStart);
      boundary = nextStart + todo.duration;
    }
  }

  return [
    ...others.map((todo) => (
      updates.has(todo.id) ? { ...todo, startMinute: updates.get(todo.id) } : todo
    )),
    target,
  ];
}

export function hasTodoOverlap(todos) {
  const ordered = [...todos].sort((left, right) => left.startMinute - right.startMinute);
  return ordered.some((todo, index) => {
    const next = ordered[index + 1];
    return next ? endMinute(todo) > next.startMinute : false;
  });
}
