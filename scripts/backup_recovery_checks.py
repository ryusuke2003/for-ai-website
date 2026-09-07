from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BACKUP_PATH = ROOT / "backup.js"


def require(source, token, message):
    if token not in source:
        raise SystemExit(f"ERROR: {message}")


def main():
    source = BACKUP_PATH.read_text(encoding="utf-8")

    require(source, "function parseRecoveryPoint(raw)", "復元ポイントの検証処理を共通化してください")
    require(source, "function readValidRecoveryRaw()", "既存の有効なUndo情報を退避してください")
    require(
        source,
        "function restorePreviousRecoveryPoint(expectedCurrentRaw, previousRaw)",
        "失敗時に以前のUndo情報を戻す処理を維持してください",
    )
    require(
        source,
        "if (localStorage.getItem(RECOVERY_STORAGE_KEY) !== expectedCurrentRaw) return false;",
        "別タブが更新したUndo情報を上書きしないよう現在値を照合してください",
    )
    require(
        source,
        "return localStorage.getItem(RECOVERY_STORAGE_KEY) === payload ? payload : null;",
        "新しく保存した復元ポイントの生JSONを検証後に返してください",
    )

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
        import_source,
        "const recoveryRestored = rollbackSucceeded\n      && restorePreviousRecoveryPoint(savedRecoveryRaw, previousRecoveryRaw);",
        "記録本体の巻き戻し確認後だけ以前のUndo情報を復元してください",
    )

    print("Backup restore failures preserve the previous valid undo generation.")


if __name__ == "__main__":
    main()
