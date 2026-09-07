from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BACKUP_PATH = ROOT / "backup.js"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f"ERROR: {start_marker} が見つかりません")
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"ERROR: {end_marker} が見つかりません")
    return source[start:end]


def main():
    source = BACKUP_PATH.read_text(encoding="utf-8")

    require("function parseRecoveryPoint(raw)" in source, "復元ポイントの検証処理を共通化してください")
    require("function readValidRecoveryRaw()" in source, "既存の有効なUndo情報を退避してください")
    require(
        "function restorePreviousRecoveryPoint(expectedCurrentRaw, previousRaw)" in source,
        "失敗時に以前のUndo情報を戻す処理を維持してください",
    )
    require(
        "if (localStorage.getItem(RECOVERY_STORAGE_KEY) !== expectedCurrentRaw) return false;" in source,
        "別タブが更新したUndo情報を上書きしないよう現在値を照合してください",
    )
    require(
        "return localStorage.getItem(RECOVERY_STORAGE_KEY) === payload ? payload : null;" in source,
        "新しく保存した復元ポイントの生JSONを検証後に返してください",
    )

    save_recovery = section(
        source,
        "function saveRecoveryPoint(data, expectedData)",
        "function restorePreviousRecoveryPoint(expectedCurrentRaw, previousRaw)",
    )
    require("localStorage.setItem(RECOVERY_STORAGE_KEY, payload);" in save_recovery, "Undo情報を書き込んでください")
    require("localStorage.getItem(RECOVERY_STORAGE_KEY) === payload" in save_recovery, "Undo情報は書き込み後に読み戻して確認してください")
    require("reportStorageFailure();" in save_recovery, "Undo情報の保存API例外は全体の保存障害として通知してください")

    restore_previous = section(
        source,
        "function restorePreviousRecoveryPoint(expectedCurrentRaw, previousRaw)",
        "function removeRecoveryPoint()",
    )
    require("localStorage.getItem(RECOVERY_STORAGE_KEY) !== expectedCurrentRaw" in restore_previous, "以前のUndoへ戻す前に現在値を照合してください")
    require("reportStorageFailure();" in restore_previous, "Undo情報の巻き戻しAPI例外は全体の保存障害として通知してください")

    remove_recovery = section(
        source,
        "function removeRecoveryPoint()",
        "function refreshRecoveryAvailability()",
    )
    remove_pos = remove_recovery.find("localStorage.removeItem(RECOVERY_STORAGE_KEY);")
    verify_pos = remove_recovery.find("localStorage.getItem(RECOVERY_STORAGE_KEY) === null")
    report_pos = remove_recovery.find("reportStorageFailure();")
    require(remove_pos >= 0, "Undo情報を削除してください")
    require(verify_pos > remove_pos, "Undo情報は削除後に読み戻して確認してください")
    require(report_pos > verify_pos, "Undo情報の削除API例外は全体の保存障害として通知してください")
    require("return false;" in remove_recovery, "Undo情報を安全に削除できなければ失敗を返してください")

    import_start = source.find("async function importBackup(file)")
    import_end = source.find("\nfunction undoLastRestore()", import_start)
    if import_start < 0 or import_end < 0:
        raise SystemExit("ERROR: importBackup() の範囲を確認できません")

    import_source = source[import_start:import_end]
    required_order = [
        "const previousRecoveryRaw = readValidRecoveryRaw();",
        "const savedRecoveryRaw = saveRecoveryPoint(recoveryData, restored);",
        "applyBackup(restored);",
        "if (currentRestoreGuard() !== expectedGuard)",
        "applyBackup(recoveryData);",
        "const rollbackSucceeded = currentRestoreGuard() === restoreGuard;",
        "restorePreviousRecoveryPoint(savedRecoveryRaw, previousRecoveryRaw)",
    ]

    last_position = -1
    for token in required_order:
        position = import_source.find(token)
        if position < 0:
            raise SystemExit(f"ERROR: importBackup() に必要な保護処理がありません: {token}")
        if position <= last_position:
            raise SystemExit(f"ERROR: importBackup() の復元/巻き戻し順序が不正です: {token}")
        last_position = position

    if "removeRecoveryPoint();" in import_source:
        raise SystemExit("ERROR: 復元失敗時に以前のUndo情報まで無条件削除しないでください")

    require(
        "const recoveryRestored = rollbackSucceeded\n      && restorePreviousRecoveryPoint(savedRecoveryRaw, previousRecoveryRaw);" in import_source,
        "記録本体の巻き戻し確認後だけ以前のUndo情報を復元してください",
    )

    undo_start = source.find("function undoLastRestore()")
    undo_end = source.find("backupExportButton.addEventListener", undo_start)
    if undo_start < 0 or undo_end < 0:
        raise SystemExit("ERROR: undoLastRestore() の範囲を確認できません")
    undo_source = source[undo_start:undo_end]

    remove_call = undo_source.find("const recoveryRemoved = removeRecoveryPoint();")
    refresh_call = undo_source.find("refreshRecoveryAvailability();", remove_call)
    failure_check = undo_source.find("if (!recoveryRemoved)", refresh_call)
    failure_message = undo_source.find("取り消し情報を安全に削除できませんでした", failure_check)
    success_message = undo_source.find("直前の復元を取り消し、復元前の記録へ戻しました。", failure_check)
    require(remove_call >= 0, "Undo完了時は復元ポイント削除結果を受け取ってください")
    require(refresh_call > remove_call, "復元ポイント削除後にUndoボタン状態を更新してください")
    require(failure_check > refresh_call, "復元ポイント削除失敗を成功表示より先に判定してください")
    require(failure_message > failure_check, "Undo情報を削除できなかった場合は利用者へ明示してください")
    require(success_message > failure_message, "Undo情報の削除確認後だけ完全成功を表示してください")

    print("Backup recovery storage failures are reported without confusing concurrency mismatches with API failures.")


if __name__ == "__main__":
    main()
