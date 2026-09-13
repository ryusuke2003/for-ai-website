import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TIMER_GUARD_PATH = ROOT / "src" / "features" / "timer" / "timerStateGuard.js"
TIMER_STORE_PATH = ROOT / "src" / "features" / "timer" / "timerStore.js"
TIMER_STATE_HOOK_PATH = ROOT / "src" / "features" / "timer" / "useTimerState.js"
TIMER_DISPLAY_PATH = ROOT / "src" / "features" / "timer" / "TimerDisplay.jsx"
PROGRESS_STYLE_PATH = ROOT / "timer-progress.css"
EXPECTED_LIMIT = 10_000


def read_limit(source):
    match = re.search(r"const MAX_BYTES = ([0-9_]+);", source)
    if not match:
        raise SystemExit("ERROR: timerStateGuard.js の MAX_BYTES が見つかりません")
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
    timer_guard_source = TIMER_GUARD_PATH.read_text(encoding="utf-8")
    timer_store = TIMER_STORE_PATH.read_text(encoding="utf-8")
    timer_state_hook = TIMER_STATE_HOOK_PATH.read_text(encoding="utf-8")
    timer_display = TIMER_DISPLAY_PATH.read_text(encoding="utf-8")

    require(not (ROOT / "timer-bootstrap.js").exists(),
            "タイマー保存値の検証器をclassic timer-bootstrap.jsへ戻さないでください")
    require(read_limit(timer_guard_source) == EXPECTED_LIMIT,
            f"タイマー保存状態の上限は {EXPECTED_LIMIT} にしてください")

    parse_position = timer_guard_source.find("JSON.parse(raw)")
    size_guard_position = timer_guard_source.find("raw.length > MAX_BYTES")
    require(parse_position >= 0 and 0 <= size_guard_position < parse_position,
            "timerStateGuard.js は JSON.parse より前にサイズ上限を確認してください")
    require("document.querySelector('#custom-preset')" not in timer_guard_source,
            "保存形式guardへhidden timer DOM処理を戻さないでください")
    require("export const timerStateGuard = Object.freeze" in timer_guard_source,
            "タイマー状態検証器はES moduleとして公開してください")

    read_stored = source_range(timer_store, "function readStoredTimerState()", "function storageShape")
    require("timerStateGuard.parse(raw)" in read_stored,
            "Reactタイマーストアはmodule検証器で保存状態を復元してください")
    require("JSON.parse(raw)" not in read_stored,
            "Reactタイマーストアで保存状態を独自にJSON.parseしないでください")
    require("import { timerStateGuard } from './timerStateGuard.js';" in timer_store,
            "ReactタイマーストアはtimerStateGuardを直接importしてください")

    initial = source_range(timer_store, "function initialTimerState()", "let currentState")
    for token in (
        "stored?.running === true",
        "Math.ceil((storedEndAt - Date.now()) / 1000)",
        "legacyCompletedState",
        "completionDate: dateKey(new Date(storedEndAt))",
        "再読み込み前の続きから再開しました。",
    ):
        require(token in initial, f"Reactタイマー復元処理が不足しています: {token}")

    require("useSyncExternalStore(subscribeTimer, getTimerSnapshot, getTimerSnapshot)" in timer_state_hook,
            "React UIはtimerStoreを直接購読してください")
    require("ONE_REACT_TIMER_STATE" not in timer_state_hook,
            "削除したtimer interopのsnapshotへ戻さないでください")
    require(not (ROOT / "legacy" / "interop" / "timer.js").exists(),
            "React移行後はlegacy/interop/timer.jsを残さないでください")

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

    print("Timer storage validation is module-owned while restore, controls, progress, end time, and title stay React-store owned.")


if __name__ == "__main__":
    main()
