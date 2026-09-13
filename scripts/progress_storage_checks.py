from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STORE_PATH = ROOT / "src" / "features" / "progress" / "progressStore.js"
TAB_GUARD_PATH = ROOT / "src" / "features" / "timer" / "tabGuard.js"
BACKUP_HOOK_PATH = ROOT / "src" / "features" / "backup" / "useBackupControl.js"


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
    store = STORE_PATH.read_text(encoding="utf-8")
    tab_guard = TAB_GUARD_PATH.read_text(encoding="utf-8")
    backup = BACKUP_HOOK_PATH.read_text(encoding="utf-8")

    require(not (ROOT / "app.js").exists(), "進捗保存runtimeをapp.jsへ戻さないでください")
    require("const MAX_DONE_COUNT_BYTES = 32;" in store, "累計回数の保存値にサイズ上限を設けてください")
    require("const DONE_COUNT_PATTERN = /^(0|[1-9]\\d{0,15})$/;" in store,
            "累計回数は正規化された10進整数だけを受け付けてください")

    parser = section(store, "export function parseDoneCount(raw)", "function readDoneCount()")
    size_guard = parser.find("raw.length > MAX_DONE_COUNT_BYTES")
    pattern_guard = parser.find("DONE_COUNT_PATTERN.test(raw)")
    number_parse = parser.find("Number(raw)")
    require(size_guard >= 0 and pattern_guard >= 0 and number_parse >= 0,
            "parseDoneCount() の検証処理が不足しています")
    require(size_guard < number_parse and pattern_guard < number_parse,
            "累計回数は数値化する前にサイズと形式を検証してください")
    require("Number.isSafeInteger(count)" in parser,
            "累計回数はsafe integerだけを受け付けてください")

    initial = section(store, "function initialState()", "let currentState")
    require("const doneCount = readDoneCount();" in initial,
            "初期表示は共通の累計値リーダーを使ってください")
    require("const history = readHistory();" in initial,
            "初期表示は検証済み履歴を使ってください")

    record_handler = section(tab_guard, "function recordPendingCompletion()", "function discardPendingCompletion()")
    require("progressRuntime.incrementInMemory?.(completedOn)" in record_handler,
            "保存不可時もReact store上の進捗を先に更新してください")
    require("progressRuntime.persistDoneCountAtLeast?.(progressUpdate.nextCount)" in record_handler,
            "タイマー消費確認後に累計を保存してください")
    require("progressRuntime.persistHistoryEntryAtLeast?.(" in record_handler,
            "累計保存確認後に日次履歴を保存してください")

    guard_progress_refresh = section(tab_guard, "function refreshGuardProgressFromStorage()", "function setCrossTabFeedback")
    require("progressRuntime.refreshFromStorage?.() === true" in guard_progress_refresh,
            "module tab guardのclaim固有再読込はReact storeへ委譲してください")

    claim = section(tab_guard, "function claimPendingCompletion()", "function verifyCompletionConsumedState()")
    disabled_branch = claim.split("if (!localSessionId)", 1)[0]
    require(
        "if (!tabCoordinationEnabled || storageCoordinationUnavailable()) return true;" in disabled_branch,
        "端末保存不可または保存障害時は保存値を再読込せず、そのまま記録処理へ進めてください",
    )
    require("refreshGuardProgressFromStorage()" not in disabled_branch,
            "端末保存不可時にメモリ上の進捗を保存値で上書きしないでください")

    backup_reader = section(backup, "function readStoredDoneCount()", "function readHistory()")
    require("parseDoneCount(safeRead(DONE_COUNT_STORAGE_KEY, '0'))" in backup_reader,
            "Reactバックアップも同じ形式・safe integer検証を通した累計値だけを使ってください")
    require(not (ROOT / "backup.js").exists(), "削除済みclassic backup.jsを戻さないでください")

    print("React progress store preserves in-memory counts while completion and backup validate persisted progress.")


if __name__ == "__main__":
    main()
