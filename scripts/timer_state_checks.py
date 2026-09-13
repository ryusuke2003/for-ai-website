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

    end_time = source_range(timer_display, "function endTimePresentation(state)", "function documentTitleFor")
    for token in (
        "!state.running || !Number.isFinite(state.endAt)",
        "const endDate = new Date(state.endAt);",
        "Number.isNaN(endDate.getTime())",
        "dateKey(endDate) === dateKey(new Date())",
        "dateTime: endDate.toISOString()",
    ):
        require(token in end_time, f"React終了予定表示に必要な処理がありません: {token}")
    require("hourCycle: 'h23'" in timer_display, "終了時刻は00〜23時表記にしてください")
    require('id="timer-end-at"' in timer_display, "終了予定はtime要素で表示してください")
    require("dateTime={endTime.dateTime || undefined}" in timer_display,
            "time要素へ機械可読な終了日時を渡してください")

    title = source_range(timer_display, "function documentTitleFor(state, timeText)", "export function TimerDisplay()")
    require("if (state.completionReady) return '完了！ — ONE';" in title,
            "未記録の完了をタイトルへ反映してください")
    require("if (state.running) return `${timeText} — ONE`;" in title,
            "実行中は残り時間をタイトルへ表示してください")
    require("state.remainingSeconds > 0 && state.remainingSeconds < fullDuration" in title,
            "途中経過だけを一時停止状態として扱ってください")
    require("`${timeText} 一時停止 — ONE`" in title,
            "一時停止中も残り時間をタイトルへ残してください")
    require("document.title = documentTitleFor(state, timeText);" in timer_display,
            "React state変更時にページタイトルを同期してください")

    require(not (ROOT / "custom-timer.js").exists(),
            "React移行後はclassic custom-timer.jsを残さないでください")

    print("Timer state parsing, React progress, end time, and document title stay synchronized.")


if __name__ == "__main__":
    main()
