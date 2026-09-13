from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")
TAB_GUARD_SOURCE = (ROOT / "tab-guard.js").read_text(encoding="utf-8")


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

    history_parser = section(
        APP_SOURCE,
        "function parseHistoryStorageEvent(raw)",
        "function parseDoneCountStorageEvent(raw)",
    )
    require("if (raw === null) return {};" in history_parser, "履歴削除は空履歴として同期してください")
    require("raw.length > MAX_HISTORY_BYTES" in history_parser, "別タブ履歴にもサイズ上限を適用してください")
    require("JSON.parse(raw)" in history_parser, "別タブ履歴はJSONとして検証してください")
    require("Array.isArray(value)" in history_parser, "配列を履歴として受け付けないでください")
    require("normalizeHistory(value)" in history_parser, "別タブ履歴も既存の履歴正規化を通してください")

    count_parser = section(
        APP_SOURCE,
        "function parseDoneCountStorageEvent(raw)",
        "function renderHistory()",
    )
    require("if (raw === null) return 0;" in count_parser, "累計削除は0回として同期してください")
    require("raw.length > MAX_DONE_COUNT_BYTES" in count_parser, "別タブ累計にもサイズ上限を適用してください")
    require("DONE_COUNT_PATTERN.test(raw)" in count_parser, "別タブ累計も既存形式で検証してください")
    require("Number.isSafeInteger(value)" in count_parser, "別タブ累計は安全な整数だけ採用してください")

    sync = section(
        APP_SOURCE,
        "function syncProgressFromStorage(event)",
        "function refreshProgressFromStorage()",
    )
    require("event.key === STORAGE_KEYS.history" in sync, "履歴キーのstorageイベントを処理してください")
    require("event.key === STORAGE_KEYS.count" in sync, "累計キーのstorageイベントを処理してください")
    require("parseHistoryStorageEvent(event.newValue)" in sync, "履歴はevent.newValueを直接検証してください")
    require("parseDoneCountStorageEvent(event.newValue)" in sync, "累計はevent.newValueを直接検証してください")
    require("focusHistory = nextHistory;" in sync and "renderHistory();" in sync,
            "履歴同期後はReact snapshot更新経路を通してください")
    require("doneCount.textContent = String(nextCount);" in sync, "累計表示を別タブへ同期してください")
    require("safeWrite(" not in sync and "localStorage.setItem(" not in sync,
            "storage同期から保存値へ書き戻さないでください")

    refresh = section(
        APP_SOURCE,
        "function refreshProgressFromStorage()",
        "function refreshProgressWhenVisible()",
    )
    require(refresh.count("if (storageAccessFailed) return;") >= 3,
            "各保存読み取り後に保存障害を確認してください")
    require("readDoneCount()" in refresh and "readHistory()" in refresh,
            "前面復帰時に累計と履歴を再確認してください")
    require("focusHistory = nextHistory;" in refresh and "renderHistory();" in refresh,
            "復帰時の履歴再読込後はReact snapshot更新経路を通してください")

    visible = section(APP_SOURCE, "function refreshProgressWhenVisible()", "function incrementFocusHistoryInMemory")
    require("document.visibilityState === 'visible'" in visible, "前面へ戻ったときだけ保存状態を再確認してください")
    require("refreshProgressFromStorage();" in visible, "前面復帰時に進捗を再確認してください")

    require("window.addEventListener('storage', syncProgressFromStorage);" in APP_SOURCE,
            "集中記録のstorage同期をapp runtimeで登録してください")
    require("document.addEventListener('visibilitychange', refreshProgressWhenVisible);" in APP_SOURCE,
            "タブ復帰時の再確認を登録してください")
    require("window.addEventListener('pageshow', refreshProgressFromStorage);" in APP_SOURCE,
            "BFCache復帰時にも進捗を再確認してください")

    require("function refreshGuardProgressFromStorage()" in TAB_GUARD_SOURCE,
            "tab-guard側のclaim専用再読込は維持してください")
    require("refreshGuardProgressFromStorage()" in section(
        TAB_GUARD_SOURCE,
        "function claimPendingCompletion()",
        "function verifyCompletionConsumedState()",
    ), "完了claim直後の最新進捗再読込を維持してください")

    print("Cross-tab progress sync remains in the small app progress runtime while tab-guard keeps claim refreshes.")


if __name__ == "__main__":
    main()
