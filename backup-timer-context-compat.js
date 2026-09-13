function hasActiveDailyTaskContext() {
  const fullDuration = selectedMinutes * 60;
  return timerId !== null
    || completionReady
    || (remainingSeconds > 0 && remainingSeconds < fullDuration);
}
