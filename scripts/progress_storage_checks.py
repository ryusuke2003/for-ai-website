from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_PATH = ROOT / "app.js"
TAB_GUARD_PATH = ROOT / "tab-guard.js"
BACKUP_PATH = ROOT / "backup.js"


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f"ERROR: {start_marker} が見つかりません")
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"ERROR: {end_marker} が見つかりません")
    return source[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    app = APP_PATH.read_text(encoding="utf-8")
    tab_guard = TAB_GUARD_PATH.read_text(encoding="utf-8")
    backup = BACKUP_PATH.read_text(encoding="utf-8")

    require("const MAX_DONE_COUNT_BYTES = 32;" in app, "累計回数の保存値にサイズ上限を設けてください")
    require("const DONE_COUNT_PATTERN = /^(0|[1-9]\\d{0,15})$/;" in app, "累計回数は正規化された10進整数だけを受け付けてください")

    parser = section(app, "function parseDoneCount(raw)", "function readDoneCount()")
    size_guard = parser.find("raw.length > MAX_DONE_COUNT_BYTES")
    pattern_guard = parser.find("DONE_COUNT_PATTERN.test(raw)")
    number_parse = parser.find("Number(raw)")
    require(size_guard >= 0 and pattern_guard >= 0 and number_parse >= 0, "parseDoneCount() の検証処理が不足しています")
    require(size_guard < number_parse and pattern_guard < number_parse, "累計回数は数値化する前にサイズと形式を検証してください")
    require("Number.isSafeInteger(count)" in parser, "累計回数はsafe integerだけを受け付けてください")

    load_state = section(app, "function loadState()", "taskInput.addEventListener")
    require("doneCount.textContent = String(readDoneCount());" in load_state, "初期表示は共通の累計値リーダーを使ってください")

    record_handler = section(app, "doneButton.addEventListener('click', () => {", "loadState();")
    require("const current = parseDoneCount(doneCount.textContent);" in record_handler, "保存不可時もメモリ上の累計を基準に加算してください")

    progress_refresh = section(tab_guard, "function refreshProgressFromStorage()", "function stopCrossTabAction")
    require("doneCount.textContent = String(readDoneCount());" in progress_refresh, "複数タブ同期も共通の累計値リーダーを使ってください")

    claim = section(tab_guard, "function claimPendingCompletion(event)", "function blockIfAnotherTabOwnsTimer")
    disabled_branch = claim.split("if (!completionReady)", 1)[0]
    require("if (!tabCoordinationEnabled) return true;" in disabled_branch, "端末保存不可時は保存値を再読込せず、そのまま記録処理へ進めてください")
    require("refreshProgressFromStorage()" not in disabled_branch, "端末保存不可時にメモリ上の進捗を保存値で上書きしないでください")

    backup_reader = section(backup, "function readStoredDoneCount()", "function historyTotal")
    require("return readDoneCount();" in backup_reader, "バックアップも共通の累計値リーダーを使ってください")

    print("Progress storage guards preserve in-memory counts and validate persisted counts strictly.")


if __name__ == "__main__":
    main()
