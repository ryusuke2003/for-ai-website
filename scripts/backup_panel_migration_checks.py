from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
COMPONENT = (ROOT / "src/components/BackupPanel.jsx").read_text(encoding="utf-8")
HOOK = (ROOT / "src/state/useBackupPanelState.js").read_text(encoding="utf-8")
STATE = (ROOT / "react-remaining-state-source.js").read_text(encoding="utf-8")
BRIDGE = (ROOT / "react-backup-panel-bridge.js").read_text(encoding="utf-8")
VITE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require("<BackupPanel />" in MAIN, "BackupPanelをReactからマウントしてください")
    require("ensureBackupPanelRoot" in MAIN, "バックアップ用React境界を生成してください")

    for token in (
        "useBackupPanelState",
        'id="backup-export-button"',
        'id="backup-import-button"',
        'id="backup-undo-button"',
        'id="backup-file-input"',
        'id="data-reset-button"',
        'id="data-reset-confirm-button"',
        'id="data-reset-cancel-button"',
        "ONE_REACT_BACKUP_PANEL",
    ):
        require(token in COMPONENT, f"BackupPanelの要件がありません: {token}")

    for token in (
        "useSyncExternalStore",
        "ONE_REACT_BACKUP_PANEL_STATE",
        "one:backup-panel-state",
    ):
        require(token in HOOK, f"BackupPanel状態フックの要件がありません: {token}")

    for token in (
        "buildBackupPanelSnapshot",
        "ONE_REACT_BACKUP_PANEL_STATE",
        "ONE_REACT_REMAINING_STATE",
        "one:backup-panel-state",
        "queueMicrotask",
        "refreshRecoveryAvailability",
        "setDataResetConfirmationVisible",
    ):
        require(token in STATE, f"バックアップ共有状態の要件がありません: {token}")
    require("MutationObserver" not in STATE, "バックアップ共有状態でDOM監視を使わないでください")

    for token in (
        "ONE_REACT_BACKUP_PANEL",
        "one:backup-panel-focus",
        "importBackup(file)",
        "refreshRecoveryAvailability()",
        "refreshBackupPanel",
    ):
        require(token in BRIDGE, f"バックアップ操作ブリッジの要件がありません: {token}")
    require("MutationObserver" not in BRIDGE, "バックアップブリッジは操作とフォーカス転送だけにしてください")
    require("snapshot" not in BRIDGE, "バックアップブリッジへ状態管理を戻さないでください")

    require('data-react-backup-panel=\"1\"' in VITE, "ViteでReact版バックアップUIを有効にしてください")
    require("react-remaining-state-source.js" in VITE, "Viteで残りのReact共有状態を読み込んでください")
    require("react-backup-panel-bridge.js" in VITE, "Viteでバックアップ操作ブリッジを読み込んでください")
    print("Backup panel migration checks passed: React subscribes to an event-driven external store without MutationObserver.")


if __name__ == "__main__":
    main()
