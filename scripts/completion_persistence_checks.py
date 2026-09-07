from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "tab-guard.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def section(start_marker, end_marker):
    start = SOURCE.find(start_marker)
    end = SOURCE.find(end_marker, start + 1)
    if start < 0 or end < 0:
        fail(f"検査範囲を取得できません: {start_marker}")
    return SOURCE[start:end]


def require(condition, message):
    if not condition:
        fail(message)


def main():
    verify_timer = section(
        "function verifyCompletionConsumedState()",
        "function persistDoneCountAtLeast",
    )
    require("readTimerState()" in verify_timer, "処理済みタイマー状態を保存後に読み戻してください")
    for token in (
        "storedState?.remainingSeconds === fullDuration",
        "storedState?.running === false",
        "storedState?.completionReady === false",
        "storedState?.completionDate === null",
    ):
        require(token in verify_timer, f"処理済みタイマー状態の検証が不足しています: {token}")
    require("reportStorageFailure();" in verify_timer, "タイマー状態の読み戻し不一致は保存障害として通知してください")

    count_persist = section(
        "function persistDoneCountAtLeast",
        "function incrementFocusHistoryInMemory",
    )
    count_write = count_persist.find("safeWrite(STORAGE_KEYS.count")
    count_read = count_persist.find("readDoneCount()")
    count_compare = count_persist.find("storedCount >= expectedCount")
    require(min(count_write, count_read, count_compare) >= 0, "累計の保存確認処理が不足しています")
    require(count_write < count_read < count_compare, "累計は保存後に読み戻して確認してください")
    require("reportStorageFailure();" in count_persist, "累計の読み戻し不一致は保存障害として通知してください")

    history_persist = section(
        "function persistHistoryEntryAtLeast",
        "function refreshRecoveryAfterCompletionAction",
    )
    history_write = history_persist.find("safeWrite(STORAGE_KEYS.history")
    history_read = history_persist.find("readHistory()")
    history_compare = history_persist.find("storedHistory[historyKey] ?? 0")
    require(min(history_write, history_read, history_compare) >= 0, "日次履歴の保存確認処理が不足しています")
    require(history_write < history_read < history_compare, "日次履歴は保存後に読み戻して確認してください")
    require("reportStorageFailure();" in history_persist, "日次履歴の読み戻し不一致は保存障害として通知してください")

    record = section(
        "function recordPendingCompletion(event)",
        "function discardPendingCompletion(event)",
    )
    claim = record.find("claimPendingCompletion(event)")
    stop = record.find("event.stopImmediatePropagation();")
    reset = record.find("resetTimer();")
    verify = record.find("verifyCompletionConsumedState()")
    memory_count = record.find("doneCount.textContent = String(next);")
    memory_history = record.find("incrementFocusHistoryInMemory(completedOn)")
    count_write_call = record.find("persistDoneCountAtLeast(next)")
    history_write_call = record.find("persistHistoryEntryAtLeast(")
    require(
        min(claim, stop, reset, verify, memory_count, memory_history, count_write_call, history_write_call) >= 0,
        "完了記録の段階的確定処理が不足しています",
    )
    require(claim < stop < reset < verify < count_write_call < history_write_call, "完了記録は claim → タイマー確定 → 累計 → 履歴 の順に保存してください")
    require(memory_count < count_write_call and memory_history < history_write_call, "保存障害時も現在タブの回数・履歴を先に維持してください")
    require(
        "if (completionConsumed && !storageAccessFailed)" in record,
        "タイマーの処理済み状態を確認できない場合は進捗を永続化しないでください",
    )
    require(
        "if (countPersisted && !storageAccessFailed)" in record,
        "累計を確認できない場合は日次履歴を永続化しないでください",
    )
    require(
        "JSONを書き出す" in record,
        "保存失敗時は現在タブの記録を救出JSONへ逃がす案内をしてください",
    )

    discard = section(
        "function discardPendingCompletion(event)",
        "function blockIfAnotherTabOwnsTimer",
    )
    discard_reset = discard.find("resetTimer();")
    discard_verify = discard.find("verifyCompletionConsumedState()")
    require(discard_reset >= 0 and discard_verify > discard_reset, "破棄でも処理済みタイマー状態を保存確認してください")
    require("未処理の完了として戻る可能性があります" in discard, "破棄の保存失敗時は再読み込みリスクを案内してください")
    require("event.stopImmediatePropagation();" in discard, "安全な破棄処理後は旧ハンドラの二重実行を止めてください")

    require(
        "doneButton.addEventListener('click', recordPendingCompletion, true);" in SOURCE,
        "記録処理はtab-guardのcapture段階で既存のclaim後に引き継いでください",
    )
    require(
        "discardButton.addEventListener('click', discardPendingCompletion, true);" in SOURCE,
        "破棄処理もcapture段階で安全に引き継いでください",
    )

    print("Completion persistence commits timer consumption before count and history, with in-memory rescue on failure.")


if __name__ == "__main__":
    main()
