const dailyGoalProgress = document.createElement('progress');
dailyGoalProgress.className = 'daily-goal-progress';
dailyGoalProgress.max = 1;
dailyGoalProgress.value = 0;
dailyGoalProgress.hidden = true;
dailyGoalProgress.setAttribute('aria-label', '今日の集中目標の進捗');
dailyGoalStatus.insertAdjacentElement('afterend', dailyGoalProgress);

function resetDailyGoalProgress() {
  dailyGoalProgress.hidden = true;
  dailyGoalProgress.max = 1;
  dailyGoalProgress.value = 0;
  dailyGoalProgress.removeAttribute('aria-valuetext');
}

function renderDailyGoalProgress() {
  if (
    !Number.isInteger(dailyGoal)
    || dailyGoal < MIN_DAILY_GOAL
    || dailyGoal > MAX_DAILY_GOAL
  ) {
    resetDailyGoalProgress();
    return;
  }

  const today = todayFocusCount();
  const visibleValue = Math.min(today, dailyGoal);
  const achieved = today >= dailyGoal;

  dailyGoalProgress.max = dailyGoal;
  dailyGoalProgress.value = visibleValue;
  dailyGoalProgress.hidden = false;
  dailyGoalProgress.setAttribute(
    'aria-valuetext',
    achieved
      ? `目標${dailyGoal}回を達成、現在${today}回`
      : `目標${dailyGoal}回中${today}回`,
  );
}

const renderDailyGoalWithoutProgress = renderDailyGoal;
renderDailyGoal = function renderDailyGoalWithProgress() {
  renderDailyGoalWithoutProgress();
  renderDailyGoalProgress();
};

renderDailyGoalProgress();
