export function buildTrayTimelineMarks(firstMinute, lastMinute) {
  const first = Math.max(0, Number(firstMinute) || 0);
  const last = Math.max(first, Number(lastMinute) || first);
  const marks = [first];
  const firstHalfHour = Math.ceil((first + 1) / 30) * 30;

  for (let minute = firstHalfHour; minute < last; minute += 30) {
    marks.push(minute);
  }

  if (last !== first) marks.push(last);
  return marks;
}
