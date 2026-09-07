import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_PATH = ROOT / "app.js"
BOOTSTRAP_PATH = ROOT / "timer-bootstrap.js"
EXPECTED_LIMIT = 10_000


def read_limit(source, name):
    match = re.search(rf"const {name} = ([0-9_]+);", source)
    if not match:
        raise SystemExit(f"ERROR: {name} が見つかりません")
    return int(match.group(1).replace("_", ""))


def require_guard_before_parse(source, guard, function_name):
    function_start = source.find(f"function {function_name}()")
    if function_start < 0:
        raise SystemExit(f"ERROR: {function_name} が見つかりません")

    parse_position = source.find("JSON.parse(raw)", function_start)
    guard_position = source.find(guard, function_start)
    if parse_position < 0 or guard_position < 0 or guard_position > parse_position:
        raise SystemExit(f"ERROR: {function_name} はJSON.parseより前にサイズ上限を確認してください")


def main():
    app_source = APP_PATH.read_text(encoding="utf-8")
    bootstrap_source = BOOTSTRAP_PATH.read_text(encoding="utf-8")

    app_limit = read_limit(app_source, "MAX_TIMER_STATE_BYTES")
    bootstrap_limit = read_limit(bootstrap_source, "MAX_BOOTSTRAP_TIMER_STATE_BYTES")
    if app_limit != EXPECTED_LIMIT or bootstrap_limit != EXPECTED_LIMIT:
        raise SystemExit(
            f"ERROR: タイマー保存状態の上限は両方 {EXPECTED_LIMIT} に揃えてください "
            f"(app={app_limit}, bootstrap={bootstrap_limit})"
        )

    require_guard_before_parse(
        app_source,
        "if (!raw || raw.length > MAX_TIMER_STATE_BYTES) return null;",
        "readTimerState",
    )
    require_guard_before_parse(
        bootstrap_source,
        "if (!raw || raw.length > MAX_BOOTSTRAP_TIMER_STATE_BYTES) return null;",
        "readBootstrappedTimerMinutes",
    )

    print("Timer state size guards are aligned and checked before JSON parsing.")


if __name__ == "__main__":
    main()
