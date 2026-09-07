from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "backup.js").read_text(encoding="utf-8")


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
    controls = section(
        "function refreshBackupControlAvailability",
        "function refreshRecoveryAvailability",
    )

    require(
        "tabCoordinationEnabled && !storageAccessFailed" in controls,
        "復元可否はタブ間調停と保存障害の両方を確認してください",
    )
    require(
        "backupImportButton.disabled = !restoreAvailable;" in controls,
        "安全に復元できない場合は復元ボタンを無効化してください",
    )
    require(
        "backupFileInput.disabled = !restoreAvailable;" in controls,
        "安全に復元できない場合はファイル入力も無効化してください",
    )
    require(
        "backupUndoButton.disabled = true;" in controls,
        "安全に復元できない場合はUndoも無効化してください",
    )
    require(
        "JSON書き出しだけ利用できます。" in controls,
        "保存障害時は書き出しだけ利用できることを案内してください",
    )
    require(
        "backupExportButton.disabled" not in SOURCE,
        "保存障害時も救出用JSON書き出しは無効化しないでください",
    )

    recovery = section("function refreshRecoveryAvailability", "function exportBackup")
    require(
        "refreshBackupControlAvailability({ announce: true })" in recovery,
        "復元用保存を読む前に復元UIの利用可否を確認し、利用不可なら案内してください",
    )

    import_body = section("async function importBackup", "function undoLastRestore")
    require(
        "refreshBackupControlAvailability({ announce: true })" in import_body,
        "復元処理の入口でも保存・調停状態を再確認してください",
    )

    undo_body = section("function undoLastRestore", "backupExportButton.addEventListener")
    require(
        "refreshBackupControlAvailability({ announce: true })" in undo_body,
        "Undo処理の入口でも保存・調停状態を再確認してください",
    )

    storage_error_handler = section(
        "window.addEventListener('one:storage-error', () => {",
        "startButton.addEventListener('click'",
    )
    require(
        "refreshBackupControlAvailability({ announce: true });" in storage_error_handler,
        "保存障害時に復元UIを即時無効化して案内してください",
    )

    require(
        SOURCE.rstrip().endswith("refreshRecoveryAvailability();"),
        "初期表示でも復元UIの利用可否を反映してください",
    )

    print("Backup restore controls stay disabled when safe restore is unavailable while rescue export remains available.")


if __name__ == "__main__":
    main()
