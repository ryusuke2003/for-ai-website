import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_PATH = ROOT / "app.js"
BOOTSTRAP_PATH = ROOT / "timer-bootstrap.js"
TIMER_DISPLAY_PATH = ROOT / "src" / "features" / "timer" / "TimerDisplay.jsx"
PROGRESS_STYLE_PATH = ROOT / "timer-progress.css"
EXPECTED_LIMIT = 10_000


def read_limit(source):
    match = re.search(r"const MAX_BYTES = ([0-9_]+);", source)
    if not match:
        raise SystemExit("ERROR: timer-bootstrap.js の MAX_BYTES が見つかりません")
    return int(match.group(1).replace("_", ""))


def source_range(source, start_token, end_token):
    start = source.find(start_token)
    end = source.find(end_token, start)
    if start < 0 or end < 0:
        raise SystemExit(f"ERROR: 検査範囲を取得できません: {start_token}")
    return source[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    app_source = APP_PATH.read_text(encoding="utf-8")
    bootstrap_source = BOOTSTRAP_PATH.read_text(encoding="utf-8")
    timer_display = TIMER_DISPLAY_PATH.read_text(encoding="utf-8")

    require(read_limit(bootstrap_source) == EXPECTED_LIMIT,
            f"タイマー保存状態の上限は {EXPECTED_LIMIT} にしてください")

    parse_position = bootstrap_source.find("JSON.parse(raw)")
    size_guard_position = bootstrap_source.find("raw.length > MAX_BYTES")
    require(parse_position >= 0 and 0 <= size_guard_position < parse_position,
            "timer-bootstrap.js は JSON.parse より前にサイズ上限を確認してください")

    bootstrap_body = source_range(
        bootstrap_source,
        "function readBootstrappedTimerMinutes()",
        "if (typeof document !== 'undefined')",
    )
    require("guard.parse(raw)" in bootstrap_body,
            "起動前タイマー復元は共通検証器を使用してください")

    app_body = source_range(app_source, "function readTimerState()", "function dateKey")
    require("ONE_TIMER_STATE_GUARD?.parse(raw)" in app_body,
            "app.js の readTimerState() は共通検証器を使用してください")
    require("JSON.parse(raw)" not in app_body,
            "app.js の readTimerState() でタイマー状態を独自にJSON.parseしないでください")

    for token in (
        'id="timer-progress"',
        'aria-label="集中時間の進捗"',
        'aria-valuetext={`${percentage}%`}',
        "const fullDuration = Math.max(1, state.selectedMinutes * 60);",
        "const elapsedSeconds = fullDuration - remainingSeconds;",
        "const percentage = Math.round((elapsedSeconds / fullDuration) * 100);",
    ):
        require(token in timer_display, f"Reactタイマー進捗に必要な処理がありません: {token}")

    require("aria-live" not in source_range(timer_display, '<progress', '/>'),
            "#timer-progress に aria-live を付けないでください")
    require(PROGRESS_STYLE_PATH.is_file(), "timer-progress.css が見つかりません")
    require(not (ROOT / "custom-timer.js").exists(),
            "React移行後はclassic custom-timer.jsを残さないでください")

    print("Timer state parsing and React progress stay synchronized behind the shared timer state.")


if __name__ == "__main__":
    main()
