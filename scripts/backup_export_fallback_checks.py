from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUP_PATH = ROOT / "src" / "features" / "backup" / "useBackupControl.js"


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
    require(not (ROOT / "backup.js").exists(), "classic backup.js を戻さないでください")

    memory_snapshot = section(backup, "function readInMemoryBackupSnapshot()", "function currentRestoreGuard()")
    require("progressStateRef.current?.doneCount" in memory_snapshot, "救出用バックアップはReact側の累計を使ってください")
    require("progressStateRef.current?.history" in memory_snapshot, "救出用バックアップはReact側の日次履歴を使ってください")
    require("timerStateRef.current?.selectedMinutes" in memory_snapshot, "救出用バックアップは現在のタイマー時間を使ってください")
    require("validateBackupData" in memory_snapshot, "メモリ状態もバックアップ検証を通してください")

    create_payload = section(backup, "function createBackupPayload()", "function parseRecoveryPoint(raw)")
    stable_read = create_payload.find("readStableBackupSnapshot()")
    discard_failed_read = create_payload.find("if (storageAccessFailedRef.current) data = null;")
    fallback_condition = create_payload.find("!coordinationAvailable || storageAccessFailedRef.current")
    memory_read = create_payload.find("readInMemoryBackupSnapshot()")
    require(stable_read >= 0, "保存可能時の安定スナップショットを維持してください")
    require(discard_failed_read >= 0, "読込途中に保存障害が起きたスナップショットは破棄してください")
    require(fallback_condition >= 0 and memory_read >= 0, "保存障害・調停不可時のメモリフォールバックが必要です")
    require(stable_read < discard_failed_read < fallback_condition < memory_read, "保存読込後に障害を再確認してからメモリへフォールバックしてください")
    require("usedMemoryFallback = data !== null;" in create_payload, "救出用バックアップをUIへ明示できる状態を保持してください")

    export = section(backup, "function exportBackup()", "function applyBackup(restored)")
    require("usedMemoryFallback" in export, "救出用JSONを書き出したことを利用者へ明示してください")
    require("救出用JSON" in export, "保存障害時のバックアップは救出用だと説明してください")
    require("実行中タイマーは含まれていません" in export, "バックアップに実行中タイマーを含めないことを明示してください")

    print("React backup export fallback checks passed.")


if __name__ == "__main__":
    main()
