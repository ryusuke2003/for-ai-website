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
    can_restore = section(
        "function canRestoreBackup()",
        "function setBackupStatus",
    )
    require(
        "hasActiveDailyTaskContext()" in can_restore,
        "現在タブの進行中・一時停止中・完了待ち状態では復元を許可しないでください",
    )
    require(
        "readTimerState()" in can_restore and "readStoredSessionId()" in can_restore,
        "別タブのアクティブなタイマー状態も復元可否へ含めてください",
    )
    require(
        "isTimerStateActive(storedState)" in can_restore,
        "保存済みタイマー状態は共通判定で確認してください",
    )

    controls = section(
        "function refreshBackupControlAvailability",
        "function refreshRecoveryAvailability",
    )

    require(
        "tabCoordinationEnabled && !storageAccessFailed" in controls,
        "復元可否はタブ間調停と保存障害の両方を確認してください",
    )
    storage_position = controls.find("const storageAvailable")
    can_restore_position = controls.find("canRestoreBackup()")
    post_failure_position = controls.find("if (storageAccessFailed)", can_restore_position)
    import_disable_position = controls.find("backupImportButton.disabled = !restoreAvailable;")
    require(
        min(storage_position, can_restore_position, post_failure_position, import_disable_position) >= 0,
        "復元UIの事前判定に必要な処理が見つかりません",
    )
    require(
        storage_position < can_restore_position < post_failure_position < import_disable_position,
        "復元UIは保存可否→タイマー状態→読込後の保存障害→UI反映の順で判定してください",
    )
    require(
        "blockedByActiveTimer = !restoreAvailable && !storageAccessFailed;" in controls,
        "タイマー状態による復元不可と保存障害を区別してください",
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
        "集中タイマーの進行中・一時停止中・未記録完了中は復元できません。JSON書き出しは利用できます。" in controls,
        "タイマー状態で復元不可の場合は理由とJSON書き出し可を案内してください",
    )
    require(
        "安全な復元に必要な端末保存・タブ間調停を利用できないため、JSON書き出しだけ利用できます。" in controls,
        "保存・調停不可の場合は従来の救出案内を維持してください",
    )
    require(
        "backupExportButton.disabled" not in SOURCE,
        "復元不可でも救出用JSON書き出しは無効化しないでください",
    )

    recovery = section("function refreshRecoveryAvailability", "function exportBackup")
    require(
        "refreshBackupControlAvailability({ announce: true })" in recovery,
        "復元用保存を読む前に復元UIの利用可否を確認し、利用不可なら案内してください",
    )

    import_body = section("async function importBackup", "function undoLastRestore")
    require(
        "refreshBackupControlAvailability({ announce: true })" in import_body,
        "復元処理の入口でも保存・調停・タイマー状態を再確認してください",
    )
    require(
        "if (!canRestoreBackup())" in import_body,
        "ファイル読込中に状態が変わった場合も復元を中止してください",
    )

    undo_body = section("function undoLastRestore", "backupExportButton.addEventListener")
    require(
        "refreshBackupControlAvailability({ announce: true })" in undo_body,
        "Undo処理の入口でも保存・調停・タイマー状態を再確認してください",
    )

    storage_handler = section(
        "window.addEventListener('storage', (event) => {",
        "window.addEventListener('one:storage-error'",
    )
    require(
        "STORAGE_KEYS.timer" in storage_handler and "refreshRecoveryAvailability();" in storage_handler,
        "別タブのタイマー状態変更で復元UIを再評価してください",
    )

    storage_error_handler = section(
        "window.addEventListener('one:storage-error', () => {",
        "startButton.addEventListener('click'",
    )
    require(
        "refreshBackupControlAvailability({ announce: true });" in storage_error_handler,
        "保存障害時に復元UIを即時無効化して案内してください",
    )

    for control in (
        "startButton.addEventListener('click', refreshRecoveryAvailability);",
        "resetButton.addEventListener('click', refreshRecoveryAvailability);",
        "doneButton.addEventListener('click', refreshRecoveryAvailability);",
        "discardButton.addEventListener('click', refreshRecoveryAvailability);",
    ):
        require(control in SOURCE, "現在タブのタイマー状態変更後に復元UIを再評価してください")
    require(
        "presetButtons.forEach((button) => button.addEventListener('click', refreshRecoveryAvailability));" in SOURCE,
        "タイマー時間変更後も復元UIを再評価してください",
    )

    require(
        SOURCE.rstrip().endswith("refreshRecoveryAvailability();"),
        "初期表示でも復元UIの利用可否を反映してください",
    )

    print("Backup restore controls proactively follow storage, coordination, and active timer state while rescue export remains available.")


if __name__ == "__main__":
    main()
