const ENDPOINT_PRIORITY_GAP_MINUTES = 15;
const CURRENT_TIME_LABEL_CLEARANCE_PX = 18;

export function buildTrayTimelineMarks(firstMinute, lastMinute) {
  const first = Math.max(0, Number(firstMinute) || 0);
  const last = Math.max(first, Number(lastMinute) || first);
  const marks = [first];
  const firstHalfHour = Math.ceil((first + 1) / 30) * 30;

  for (let minute = firstHalfHour; minute < last; minute += 30) {
    const overlapsFirst = minute - first < ENDPOINT_PRIORITY_GAP_MINUTES;
    const overlapsLast = last - minute < ENDPOINT_PRIORITY_GAP_MINUTES;
    if (overlapsFirst || overlapsLast) continue;
    marks.push(minute);
  }

  if (last !== first) marks.push(last);
  return marks;
}

export function shouldHideTrayTimelineMarkLabel(markMinute, currentMinute, pixelsPerMinute) {
  const mark = Number(markMinute);
  const current = Number(currentMinute);
  const scale = Number(pixelsPerMinute);
  if (!Number.isFinite(mark) || !Number.isFinite(current) || !Number.isFinite(scale) || scale <= 0) {
    return false;
  }

  return Math.abs(mark - current) * scale <= CURRENT_TIME_LABEL_CLEARANCE_PX;
}
