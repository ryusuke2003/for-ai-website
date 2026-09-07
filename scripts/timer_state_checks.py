import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_PATH = ROOT / "app.js"
BOOTSTRAP_PATH = ROOT / "timer-bootstrap.js"
VALIDATOR_PATH = ROOT / "timer-state.js"
EXPECTED_LIMIT = 10_000


def read_limit(source):
    match = re.search(r"const MAX_BYTES = ([0-9_]+);", source)
    if not match:
        raise SystemExit("ERROR: timer-state.js の MAX_BYTES が見つかりません")
    return int(match.group(1).replace("_", ""))


def function_body(source, function_name, next_function_name):
    start = source.find(f"function {function_name}")
    end = source.find(f"function {next_function_name}", start)
    if start < 0 or end < 0:
        raise SystemExit(f"ERROR: {function_name} の検査範囲を取得できません")
    return source[start:end]


def main():
    app_source = APP_PATH.read_text(encoding="utf-8")
    bootstrap_source = BOOTSTRAP_PATH.read_text(encoding="utf-8")
    validator_source = VALIDATOR_PATH.read_text(encoding="utf-8")

    if read_limit(validator_source) != EXPECTED_LIMIT:
        raise SystemExit(f"ERROR: タイマー保存状態の上限は {EXPECTED_LIMIT} にしてください")

    parse_position = validator_source.find("JSON.parse(raw)")
    size_guard_position = validator_source.find("raw.length > MAX_BYTES")
    if parse_position < 0 or size_guard_position < 0 or size_guard_position > parse_position:
        raise SystemExit("ERROR: timer-state.js は JSON.parse より前にサイズ上限を確認してください")

    bootstrap_body = function_body(
        bootstrap_source,
        "readBootstrappedTimerMinutes",
        "const bootstrappedCustomMinutes",
    )
    if "ONE_TIMER_STATE_GUARD?.parse(raw)" not in bootstrap_body:
        raise SystemExit("ERROR: 起動前タイマー復元は共通検証器を使用してください")
    if "JSON.parse(raw)" in bootstrap_source:
        raise SystemExit("ERROR: timer-bootstrap.js でタイマー状態を独自にJSON.parseしないでください")

    app_body = function_body(app_source, "readTimerState", "dateKey")
    if "ONE_TIMER_STATE_GUARD?.parse(raw)" not in app_body:
        raise SystemExit("ERROR: app.js の readTimerState() は共通検証器を使用してください")
    if "JSON.parse(raw)" in app_body:
        raise SystemExit("ERROR: app.js の readTimerState() でタイマー状態を独自にJSON.parseしないでください")

    print("Timer state parsing is centralized behind the shared validator.")


if __name__ == "__main__":
    main()
