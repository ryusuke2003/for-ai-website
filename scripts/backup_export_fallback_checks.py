from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
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
    backup = BACKUP_PATH.read_text(encoding="utf-8")

    memory_snapshot = section(
        backup,
        "function readInMemoryBackupSnapshot()",
        "function currentRestoreGuard()",
    )
    require("parseDoneCount(doneCount.textContent)" in memory_snapshot, "救出用バックアップは画面上の累計を使ってください")
    require("normalizeHistory(focusHistory)" in memory_snapshot, "救出用バックアップはメモリ上の日次履歴を使ってください")
    require("selectedMinutes" in memory_snapshot, "救出用バックアップは現在のタイマー時間を使ってください")
    require("validateBackupData" in memory_snapshot, "メモリ状態も既存のバックアップ検証を通してください")

    create_payload = section(backup, "function createBackupPayload()", "function isStrictHistory")
    stable_read = create_payload.find("readStableBackupSnapshot()")
    discard_failed_read = create_payload.find("if (storageAccessFailed) data = null;")
    fallback_condition = create_payload.find("!tabCoordinationEnabled || storageAccessFailed")
    memory_read = create_payload.find("readInMemoryBackupSnapshot()")
    require(stable_read >= 0, "保存可能時の安定スナップショットを維持してください")
    require(discard_failed_read >= 0, "読込途中に保存障害が起きたスナップショットは破棄してください")
    require(fallback_condition >= 0 and memory_read >= 0, "保存障害時のメモリフォールバックが必要です")
    require(
        stable_read < discard_failed_read < fallback_condition < memory_read,
        "保存読込後に障害を再確認してからメモリへフォールバックしてください",
    )
    require("backupExportUsedMemoryFallback = data !== null;" in create_payload, "救出用バックアップをUIへ明示できる状態を保持してください")

    export = section(backup, "function exportBackup()", "function applyBackup(restored)")
    require("backupExportUsedMemoryFallback" in export, "救出用JSONを書き出したことを利用者へ明示してください")
    require("救出用JSON" in export, "保存障害時のバックアップは救出用だと説明してください")
    require("タスク本文や実行中タイマーは含まれていません" in export, "救出用JSONに含まれない情報を明示してください")

    print("Backup export falls back to validated in-memory state only when persistent storage is unavailable.")


if __name__ == "__main__":
    main()
