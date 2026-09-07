import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_PATH = ROOT / "app.js"
BOOTSTRAP_PATH = ROOT / "timer-bootstrap.js"
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
    app_source = APP_PATH.read_text(encoding="utf-8")
    bootstrap_source = BOOTSTRAP_PATH.read_text(encoding="utf-8")

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

    print("Timer state parsing is centralized behind the shared validator.")


if __name__ == "__main__":
    main()
