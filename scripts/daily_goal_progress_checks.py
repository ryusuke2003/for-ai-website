from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
PROGRESS_DETAILS_SOURCE = (ROOT / "src" / "features" / "progress" / "ProgressDetails.jsx").read_text(encoding="utf-8")
HOOK_SOURCE = (ROOT / "src" / "features" / "progress" / "useDailyGoalControl.js").read_text(encoding="utf-8")
INTEROP_SOURCE = (ROOT / "legacy" / "interop" / "settings-progress.js").read_text(encoding="utf-8")
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
    require(not (ROOT / "legacy" / "interop" / "progress-backup.js").exists(), "削除済みprogress-backup interopを戻さないでください")

    progress_markup = section(
        PROGRESS_DETAILS_SOURCE,
        '<progress\n        className="daily-goal-progress"',
        '/>',
    )
    require('max={dailyGoal.progressMax}' in progress_markup, "React progressへ目標回数を渡してください")
    require('value={dailyGoal.progressValue}' in progress_markup, "React progressへ現在値を渡してください")
    require('hidden={dailyGoal.progressHidden}' in progress_markup, "目標未設定時はReact progressを隠してください")
    require('aria-label="今日の集中目標の進捗"' in progress_markup, "進捗バーへ目的を示すラベルを付けてください")
    require('aria-valuetext={dailyGoal.progressAriaValueText || undefined}' in progress_markup, "進捗の読み上げ文をReact hookから設定してください")
    require('aria-live' not in progress_markup, "目標進捗バーをaria-liveにして重複通知しないでください")

    for token in (
        "progressHidden: true",
        "progressMax: 1",
        "progressValue: 0",
        "Math.min(todayCount, activeGoal)",
        "Math.max(activeGoal - todayCount, 0)",
        "目標${activeGoal}回を達成、現在${todayCount}回",
        "目標${activeGoal}回中${todayCount}回",
    ):
        require(token in HOOK_SOURCE, f"React日次目標進捗に必要な処理がありません: {token}")

    require("buildDailyGoalProgressSnapshot" not in INTEROP_SOURCE, "日次目標進捗をlegacy interopへ戻さないでください")
    require("goalProgress" not in INTEROP_SOURCE, "残存progress interopに日次目標進捗を含めないでください")

    require(".daily-goal-progress {" in STYLE_SOURCE, "日次目標進捗バー専用のレイアウトを維持してください")
    require("accent-color: currentColor;" in section(STYLE_SOURCE, ".daily-goal-progress {", "}"), "テーマに追従するprogress表示を維持してください")
    require(".daily-goal-progress[hidden]" in STYLE_SOURCE and "display: none;" in STYLE_SOURCE, "author CSSでもhidden属性を確実に尊重してください")

    print("Daily goal progress is fully React-owned, capped at the goal, and absent from legacy interop.")


if __name__ == "__main__":
    main()
