from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
COMPONENT = (ROOT / "src/components/BackupPanel.jsx").read_text(encoding="utf-8")
BRIDGE = (ROOT / "react-backup-panel-bridge.js").read_text(encoding="utf-8")
VITE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require("<BackupPanel />" in MAIN, "BackupPanelをReactからマウントしてください")
    require("ensureBackupPanelRoot" in MAIN, "バックアップ用React境界を生成してください")

    for token in (
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
        "ONE_REACT_BACKUP_PANEL",
        "backupPanelSnapshot",
        "one:backup-panel-state",
        "one:backup-panel-focus",
        "importBackup(file)",
        "MutationObserver",
        "refreshRecoveryAvailability()",
    ):
        require(token in BRIDGE, f"バックアップブリッジの要件がありません: {token}")

    require('data-react-backup-panel=\"1\"' in VITE, "ViteでReact版バックアップUIを有効にしてください")
    require("react-backup-panel-bridge.js" in VITE, "Viteでバックアップブリッジを読み込んでください")
    print("Backup panel migration checks passed.")


if __name__ == "__main__":
    main()
