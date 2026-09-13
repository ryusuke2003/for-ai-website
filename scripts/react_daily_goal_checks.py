from pathlib import Path

import daily_goal_checks as legacy_checks


ROOT = Path(__file__).resolve().parent.parent
BACKUP_PANEL_SOURCE = (ROOT / "src" / "features" / "backup" / "BackupPanel.jsx").read_text(encoding="utf-8")

# The hidden runtime scaffold still carries the DOM nodes used by classic state logic,
# while user-facing copy now lives in React. Keep the existing behavioral assertions
# and include the React source when checking explanatory UI text.
legacy_checks.INDEX_SOURCE = f"{legacy_checks.INDEX_SOURCE}\n{BACKUP_PANEL_SOURCE}"


if __name__ == "__main__":
    legacy_checks.main()
