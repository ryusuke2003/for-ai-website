import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
APP_PATH = ROOT / "app.js"
BOOTSTRAP_PATH = ROOT / "timer-bootstrap.js"
CUSTOM_TIMER_PATH = ROOT / "custom-timer.js"
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


def main():
    index_source = INDEX_PATH.read_text(encoding="utf-8")
    app_source = APP_PATH.read_text(encoding="utf-8")
    bootstrap_source = BOOTSTRAP_PATH.read_text(encoding="utf-8")
    custom_timer_source = CUSTOM_TIMER_PATH.read_text(encoding="utf-8")

    if read_limit(bootstrap_source) != EXPECTED_LIMIT:
        raise SystemExit(f"ERROR: タイマー保存状態の上限は {EXPECTED_LIMIT} にしてください")

    parse_position = bootstrap_source.find("JSON.parse(raw)")
    size_guard_position = bootstrap_source.find("raw.length > MAX_BYTES")
    if parse_position < 0 or size_guard_position < 0 or size_guard_position > parse_position:
        raise SystemExit("ERROR: timer-bootstrap.js は JSON.parse より前にサイズ上限を確認してください")

    bootstrap_body = source_range(
        bootstrap_source,
        "function readBootstrappedTimerMinutes()",
        "if (typeof document !== 'undefined')",
    )
    if "guard.parse(raw)" not in bootstrap_body:
        raise SystemExit("ERROR: 起動前タイマー復元は共通検証器を使用してください")

    app_body = source_range(app_source, "function readTimerState()", "function dateKey")
    if "ONE_TIMER_STATE_GUARD?.parse(raw)" not in app_body:
        raise SystemExit("ERROR: app.js の readTimerState() は共通検証器を使用してください")
    if "JSON.parse(raw)" in app_body:
        raise SystemExit("ERROR: app.js の readTimerState() でタイマー状態を独自にJSON.parseしないでください")

    progress_match = re.search(r"<progress\b[^>]*id=\"timer-progress\"[^>]*>", index_source)
    if not progress_match:
        raise SystemExit("ERROR: タイマー進捗用の #timer-progress が見つかりません")
    progress_tag = progress_match.group(0)
    if 'aria-label="集中時間の進捗"' not in progress_tag:
        raise SystemExit("ERROR: #timer-progress に用途が分かる aria-label を付けてください")
    if "aria-live" in progress_tag:
        raise SystemExit("ERROR: #timer-progress に aria-live を付けないでください。頻繁な読み上げにつながります")
    if 'href="timer-progress.css"' not in index_source:
        raise SystemExit("ERROR: タイマー進捗用スタイルを読み込んでください")
    if not PROGRESS_STYLE_PATH.is_file():
        raise SystemExit("ERROR: timer-progress.css が見つかりません")

    progress_body = source_range(
        custom_timer_source,
        "function renderTimerProgress()",
        "const renderTimerWithoutProgress = renderTimer;",
    )
    required_progress_tokens = (
        "selectedMinutes * 60",
        "fullDuration - remainingSeconds",
        "timerProgress.max = fullDuration",
        "timerProgress.value = elapsedSeconds",
        "aria-valuetext",
    )
    for token in required_progress_tokens:
        if token not in progress_body:
            raise SystemExit(f"ERROR: タイマー進捗同期に必要な処理がありません: {token}")

    if "renderTimer = function renderTimerWithProgress()" not in custom_timer_source:
        raise SystemExit("ERROR: renderTimer() 更新時に進捗バーも同期してください")
    if "renderTimerProgress();\nrefreshRecoveryAvailability();" not in custom_timer_source:
        raise SystemExit("ERROR: 初期表示でも保存済みタイマーの進捗を反映してください")

    print("Timer state parsing and visible progress stay synchronized behind the shared timer state.")


if __name__ == "__main__":
    main()
