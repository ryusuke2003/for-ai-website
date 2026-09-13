from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STORE_SOURCE = (ROOT / "src" / "features" / "progress" / "progressStore.js").read_text(encoding="utf-8")
TAB_GUARD_SOURCE = (ROOT / "src" / "features" / "timer" / "tabGuard.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        fail(f"{start_marker} が見つかりません")
    end = source.find(end_marker, start)
    if end < 0:
        fail(f"{end_marker} が見つかりません")
    return source[start:end]


def main():
    require(not (ROOT / "stats.js").exists(), "進捗同期を移行後にstats.jsを残さないでください")
    require(not (ROOT / "app.js").exists(), "進捗同期をReact移行後にapp.jsへ戻さないでください")

    history_parser = section(
        STORE_SOURCE,
        "function parseHistoryStorageEvent(raw)",
        "function parseDoneCountStorageEvent(raw)",
    )
    require("if (raw === null) return {};" in history_parser, "履歴削除は空履歴として同期してください")
    require("raw.length > MAX_HISTORY_BYTES" in history_parser, "別タブ履歴にもサイズ上限を適用してください")
    require("JSON.parse(raw)" in history_parser, "別タブ履歴はJSONとして検証してください")
    require("Array.isArray(value)" in history_parser, "配列を履歴として受け付けないでください")
    require("normalizeHistory(value)" in history_parser, "別タブ履歴も既存の履歴正規化を通してください")

    count_parser = section(
        STORE_SOURCE,
        "function parseDoneCountStorageEvent(raw)",
        "function initialState()",
    )
    require("if (raw === null) return 0;" in count_parser, "累計削除は0回として同期してください")
    require("raw.length > MAX_DONE_COUNT_BYTES" in count_parser, "別タブ累計にもサイズ上限を適用してください")
    require("DONE_COUNT_PATTERN.test(raw)" in count_parser, "別タブ累計も既存形式で検証してください")
    require("Number.isSafeInteger(value)" in count_parser, "別タブ累計は安全な整数だけ採用してください")

    sync = section(
        STORE_SOURCE,
        "function syncProgressFromStorage(event)",
        "function refreshFromStorage()",
    )
    require("event.key === HISTORY_STORAGE_KEY" in sync, "履歴キーのstorageイベントを処理してください")
    require("event.key === DONE_COUNT_STORAGE_KEY" in sync, "累計キーのstorageイベントを処理してください")
    require("parseHistoryStorageEvent(event.newValue)" in sync, "履歴はevent.newValueを直接検証してください")
    require("parseDoneCountStorageEvent(event.newValue)" in sync, "累計はevent.newValueを直接検証してください")
    require(sync.count("replaceState(") >= 2, "別タブ同期はReact store snapshotを更新してください")
    require("safeWrite(" not in sync and "localStorage.setItem(" not in sync,
            "storage同期から保存値へ書き戻さないでください")

    refresh = section(
        STORE_SOURCE,
        "function refreshFromStorage()",
        "function incrementInMemory",
    )
    require(refresh.count("if (storageAccessFailed) return false;") >= 3,
            "各保存読み取り後に保存障害を確認してください")
    require("readDoneCount()" in refresh and "readHistory()" in refresh,
            "前面復帰時に累計と履歴を再確認してください")
    require("replaceState({ doneCount: nextCount, history: nextHistory });" in refresh,
            "復帰時は検証済み保存値をReact storeへ反映してください")

    require("window.addEventListener('storage', syncProgressFromStorage);" in STORE_SOURCE,
            "集中記録のstorage同期をReact storeで登録してください")
    require("window.addEventListener('pageshow', refreshFromStorage);" in STORE_SOURCE,
            "BFCache復帰時にも進捗を再確認してください")
    require("document.visibilityState !== 'visible'" in STORE_SOURCE and "refreshFromStorage();" in STORE_SOURCE,
            "前面復帰時に進捗を再確認してください")

    guard_refresh = section(
        TAB_GUARD_SOURCE,
        "function refreshGuardProgressFromStorage()",
        "function setCrossTabFeedback",
    )
    require("progressRuntime.refreshFromStorage?.() === true" in guard_refresh,
            "claim固有再読込はReact progress runtimeへ委譲してください")
    require("refreshGuardProgressFromStorage()" in section(
        TAB_GUARD_SOURCE,
        "function claimPendingCompletion()",
        "function verifyCompletionConsumedState()",
    ), "完了claim直後の最新進捗再読込を維持してください")

    print("Cross-tab progress sync is React-store owned while module tab guard keeps claim-specific refreshes.")


if __name__ == "__main__":
    main()
