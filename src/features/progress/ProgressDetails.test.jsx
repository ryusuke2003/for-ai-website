import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProgressDetails } from './ProgressDetails.jsx';
import { buildProgressInsights } from './progressInsights.js';

function progressState() {
  return {
    history: Array.from({ length: 7 }, (_, index) => ({
      level: index % 5,
      ariaLabel: `9月${index + 1}日 ${index}回`,
      current: index === 6,
      count: index,
      weekday: '月',
    })),
    activity: [
      { level: 0, placeholder: true, current: false, ariaLabel: '' },
      { level: 3, placeholder: false, current: true, ariaLabel: '9月13日 3回' },
    ],
    activitySummary: '直近30日で12回集中しました。',
  };
}

function dailyGoal(overrides = {}) {
  return {
    value: '5',
    invalid: false,
    clearHidden: false,
    status: '今日の目標 5回 · 現在2回 · あと3回。',
    progressHidden: false,
    progressMax: 5,
    progressValue: 2,
    progressAriaValueText: '目標5回中2回',
    change: vi.fn(),
    apply: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

describe('ProgressDetails daily goal progress', () => {
  it('目標の現在値・上限・読み上げ文をprogressへ反映する', () => {
    render(<ProgressDetails state={progressState()} dailyGoal={dailyGoal()} />);

    const progress = screen.getByRole('progressbar', { name: '今日の集中目標の進捗' });
    expect(progress.getAttribute('max')).toBe('5');
    expect(progress.getAttribute('value')).toBe('2');
    expect(progress.getAttribute('aria-valuetext')).toBe('目標5回中2回');
    expect(progress.hidden).toBe(false);
    expect(progress.hasAttribute('aria-live')).toBe(false);
  });

  it('目標未設定時はprogressと解除ボタンを隠す', () => {
    render(<ProgressDetails state={progressState()} dailyGoal={dailyGoal({
      value: '',
      clearHidden: true,
      progressHidden: true,
      progressMax: 1,
      progressValue: 0,
      progressAriaValueText: '',
      status: '今日の目標は未設定です。1〜12回で設定できます。',
    })} />);

    const progress = screen.getByLabelText('今日の集中目標の進捗');
    const clearButton = document.getElementById('daily-goal-clear');
    expect(progress.hidden).toBe(true);
    expect(clearButton).not.toBeNull();
    expect(clearButton.hidden).toBe(true);
  });

  it('入力・設定・解除をdailyGoalの操作へ委譲する', () => {
    const goal = dailyGoal();
    render(<ProgressDetails state={progressState()} dailyGoal={goal} />);

    fireEvent.change(screen.getByLabelText('今日の目標'), { target: { value: '6' } });
    expect(goal.change).toHaveBeenCalledWith('6');

    fireEvent.click(screen.getByRole('button', { name: '設定' }));
    expect(goal.apply).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '目標を解除' }));
    expect(goal.clear).toHaveBeenCalledOnce();
  });
});

describe('ProgressDetails current date semantics', () => {
  it('今日を7日履歴と30日マップの両方で意味的・視覚的に示す', () => {
    const today = new Date(2026, 8, 14, 12, 0, 0, 0);
    const state = buildProgressInsights({
      '2026-09-13': 2,
      '2026-09-14': 3,
    }, today);

    const historyToday = state.history.find((day) => day.current);
    const activityToday = state.activity.find((cell) => cell.current);
    expect(historyToday).toMatchObject({
      ariaLabel: '今日 2026-09-14: 3回',
      count: '3',
      weekday: '今日',
      current: true,
    });
    expect(activityToday).toMatchObject({
      ariaLabel: '今日 2026-09-14: 3回',
      current: true,
      placeholder: false,
      level: 3,
    });

    render(<ProgressDetails state={state} dailyGoal={dailyGoal()} />);

    const historyCurrent = document.querySelector('#history-grid [aria-current="date"]');
    const activityCurrent = document.querySelector('#activity-grid [aria-current="date"]');

    expect(historyCurrent).not.toBeNull();
    expect(historyCurrent.getAttribute('aria-label')).toBe('今日 2026-09-14: 3回');
    expect(historyCurrent.textContent).toContain('今日');

    expect(activityCurrent).not.toBeNull();
    expect(activityCurrent.getAttribute('aria-label')).toBe('今日 2026-09-14: 3回');
    expect(activityCurrent.className).toContain('outline');
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(2);
  });
});
