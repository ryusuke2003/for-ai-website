from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
APP_SOURCE = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
DETAILS_SOURCE = (ROOT / "src" / "features" / "progress" / "ProgressDetails.jsx").read_text(encoding="utf-8")
OVERVIEW_SOURCE = (ROOT / "src" / "features" / "progress" / "ProgressOverview.jsx").read_text(encoding="utf-8")
HOOK_SOURCE = (ROOT / "src" / "features" / "progress" / "useDailyGoalControl.js").read_text(encoding="utf-8")
RESET_SOURCE = (ROOT / "privacy-reset.js").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f"ERROR: {start_marker} が見つかりません")
    end = source.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f"ERROR: {end_marker} が見つかりません")
    return source[start:end]


def main():
    require('id="daily-goal-input"' not in INDEX_SOURCE, "日次目標UIをlegacy scaffoldへ戻さないでください")
    require(not (ROOT / "stats.js").exists(), "日次目標や集計をstats.jsへ戻さないでください")

    for token in (
        "const insights = buildProgressInsights(progressState.history);",
        "useDailyGoalControl(insights.todayCount)",
        "<ProgressOverview state={overviewState} todayAriaLabel={dailyGoal.todayAriaLabel}",
        "<ProgressDetails state={insights} dailyGoal={dailyGoal}",
    ):
        require(token in APP_SOURCE, f"ProgressSectionの日次目標共有に必要です: {token}")

    for token in (
        'id="daily-goal-input"',
        'min="1"',
        'max="12"',
        'step="1"',
        'aria-describedby="daily-goal-status"',
        'aria-invalid={dailyGoal.invalid}',
        'onChange={(event) => dailyGoal.change(event.target.value)}',
        "event.isComposing || event.key !== 'Enter'",
        'dailyGoal.apply();',
        'hidden={dailyGoal.clearHidden}',
        'onClick={dailyGoal.clear}',
        'id="daily-goal-status" role="status" aria-live="polite"',
    ):
        require(token in DETAILS_SOURCE, f"React日次目標UIに必要です: {token}")

    require('aria-label={todayAriaLabel || undefined}' in OVERVIEW_SOURCE,
            "今日の回数へ日次目標進捗の読み上げを反映してください")

    for token in (
        "const DAILY_GOAL_STORAGE_KEY = 'one.dailyGoal.v1';",
        "const MIN_DAILY_GOAL = 1;",
        "const MAX_DAILY_GOAL = 12;",
        "const MAX_DAILY_GOAL_STATE_BYTES = 128;",
        "raw.length > MAX_DAILY_GOAL_STATE_BYTES",
        "Object.keys(value).length !== 2",
        "Object.hasOwn(value, 'date')",
        "Object.hasOwn(value, 'goal')",
        "isValidDateKey(value.date)",
        "Number.isInteger(value.goal)",
        "value.goal < MIN_DAILY_GOAL",
        "value.goal > MAX_DAILY_GOAL",
    ):
        require(token in HOOK_SOURCE, f"保存済み日次目標の厳格検証に必要です: {token}")

    remover = section(HOOK_SOURCE, "function removeStoredDailyGoal(expectedRaw)", "function persistDailyGoal")
    current_read = remover.find("localStorage.getItem(DAILY_GOAL_STORAGE_KEY)")
    mismatch_guard = remover.find("expectedRaw !== undefined && current !== expectedRaw")
    delete_position = remover.find("localStorage.removeItem(DAILY_GOAL_STORAGE_KEY)")
    verify_position = remover.rfind("localStorage.getItem(DAILY_GOAL_STORAGE_KEY) === null")
    require(min(current_read, mismatch_guard, delete_position, verify_position) >= 0,
            "目標削除の競合保護・削除・確認を維持してください")
    require(current_read < mismatch_guard < delete_position < verify_position,
            "目標削除前に保存値が想定値のままか確認してください")

    persist = section(HOOK_SOURCE, "function persistDailyGoal", "function parseDailyGoalInput")
    set_position = persist.find("localStorage.setItem(DAILY_GOAL_STORAGE_KEY, payload)")
    read_position = persist.find("localStorage.getItem(DAILY_GOAL_STORAGE_KEY) === payload")
    require(min(set_position, read_position) >= 0 and set_position < read_position,
            "目標保存後は読み戻して一致を確認してください")
    require("JSON.stringify({ date: todayKey, goal })" in persist,
            "目標には設定日を一緒に保存してください")

    require("window.dispatchEvent(new Event('one:storage-error'))" in HOOK_SOURCE,
            "日次目標の保存失敗をアプリ全体へ通知してください")
    require("window.addEventListener('storage', handleStorage)" in HOOK_SOURCE,
            "別タブの日次目標変更を同期してください")
    require("window.addEventListener('pageshow', handlePageShow)" in HOOK_SOURCE,
            "BFCache復帰時に日次目標を再同期してください")
    require("document.visibilityState === 'visible'" in HOOK_SOURCE,
            "前面復帰時だけ保存値を再確認してください")
    require("removeStoredDailyGoal(raw)" in HOOK_SOURCE,
            "期限切れまたは不正な保存値は競合保護付きで掃除してください")

    require("Math.max(activeGoal - todayCount, 0)" in HOOK_SOURCE,
            "目標までの残り回数を負数にしないでください")
    require("Math.min(todayCount, activeGoal)" in HOOK_SOURCE,
            "進捗値が目標値を超えないようにしてください")
    require("今日の目標 ${activeGoal}回を達成しました" in HOOK_SOURCE,
            "目標達成を明示してください")
    require("あと${remaining}回" in HOOK_SOURCE,
            "未達成時は残り回数を表示してください")
    require("今日 ${todayCount}回、目標${activeGoal}回を達成" in HOOK_SOURCE,
            "達成状態を今日の回数のaria-labelへ反映してください")

    require("'one.dailyGoal.v1'" in RESET_SOURCE or '"one.dailyGoal.v1"' in RESET_SOURCE,
            "日次目標保存キーを端末データ削除対象に含めてください")

    print("Daily goal state is React-owned with strict storage validation, cross-tab sync, and safe cleanup.")


if __name__ == "__main__":
    main()
