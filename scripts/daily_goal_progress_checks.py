from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
PROGRESS_DETAILS_SOURCE = (ROOT / "src" / "features" / "progress" / "ProgressDetails.jsx").read_text(encoding="utf-8")
INTEROP_SOURCE = (ROOT / "legacy" / "interop" / "progress-backup.js").read_text(encoding="utf-8")
STYLE_SOURCE = (ROOT / "timer-progress.css").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        fail(f"{start_marker} が見つかりません")
    end = source.find(end_marker, start + len(start_marker))
    if end < 0:
        fail(f"{end_marker} が見つかりません")
    return source[start:end]


def main():
    require('daily-goal-progress.js' not in INDEX_SOURCE, "削除済みclassic日次目標進捗scriptを読み込まないでください")
    require(not (ROOT / "daily-goal-progress.js").exists(), "React移行後はdaily-goal-progress.jsを残さないでください")

    progress_markup = section(
        PROGRESS_DETAILS_SOURCE,
        '<progress\n        className="daily-goal-progress"',
        '/>',
    )
    require('max={state.goalProgressMax}' in progress_markup, "React progressへ目標回数を渡してください")
    require('value={state.goalProgressValue}' in progress_markup, "React progressへ現在値を渡してください")
    require('hidden={state.goalProgressHidden}' in progress_markup, "目標未設定時はReact progressを隠してください")
    require('aria-label="今日の集中目標の進捗"' in progress_markup, "進捗バーへ目的を示すラベルを付けてください")
    require('aria-valuetext={state.goalProgressAriaValueText || undefined}' in progress_markup, "進捗の読み上げ文をReactから設定してください")
    require('aria-live' not in progress_markup, "目標進捗バーをaria-liveにして重複通知しないでください")

    builder = section(
        INTEROP_SOURCE,
        "function buildDailyGoalProgressSnapshot()",
        "function buildProgressDetailsSnapshot()",
    )
    for token in (
        "Number.isInteger(dailyGoal)",
        "dailyGoal < MIN_DAILY_GOAL",
        "dailyGoal > MAX_DAILY_GOAL",
        "const today = todayFocusCount();",
        "Math.min(today, dailyGoal)",
        "today >= dailyGoal",
        "max: dailyGoal",
        "value: visibleValue",
        "目標${dailyGoal}回を達成、現在${today}回",
        "目標${dailyGoal}回中${today}回",
    ):
        require(token in builder, f"日次目標進捗snapshotに必要な処理がありません: {token}")

    require("hidden: true" in builder and "max: 1" in builder and "value: 0" in builder,
            "目標未設定時は安全な初期値へ戻してください")
    require("safeWrite(" not in builder and "localStorage" not in builder,
            "進捗表示のために新しい保存処理を追加しないでください")

    details_builder = section(
        INTEROP_SOURCE,
        "function buildProgressDetailsSnapshot()",
        "function buildBackupPanelSnapshot()",
    )
    require("const goalProgress = buildDailyGoalProgressSnapshot();" in details_builder,
            "ProgressDetails snapshotから共通の日次目標進捗計算を使用してください")
    require("goalProgressHidden: goalProgress.hidden" in details_builder,
            "React側へ進捗の表示状態を公開してください")
    require("goalProgressAriaValueText: goalProgress.ariaValueText" in details_builder,
            "React側へ進捗の読み上げ文を公開してください")

    require(".daily-goal-progress {" in STYLE_SOURCE, "日次目標進捗バー専用のレイアウトを維持してください")
    require("accent-color: currentColor;" in section(STYLE_SOURCE, ".daily-goal-progress {", "}"),
            "テーマに追従するprogress表示を維持してください")
    require(".daily-goal-progress[hidden]" in STYLE_SOURCE and "display: none;" in STYLE_SOURCE,
            "author CSSでもhidden属性を確実に尊重してください")

    print("Daily goal progress is rendered by React, capped at the goal, hidden when unset, and no longer needs a classic runtime file.")


if __name__ == "__main__":
    main()
