from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
APP_SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")
SHORTCUTS_SOURCE = (ROOT / "shortcuts.js").read_text(encoding="utf-8")
STORAGE_SOURCE = (ROOT / "storage-status.js").read_text(encoding="utf-8")
STYLES_SOURCE = (ROOT / "styles.css").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    for token in ('id="task-input"', 'class="card task-card"', 'task-character-count'):
        require(token not in INDEX_SOURCE, f"廃止したタスク入力UIを残さないでください: {token}")

    for token in ('taskInput', 'STORAGE_KEYS.task', 'STORAGE_KEYS.taskDate', 'loadDailyTask', 'hasActiveDailyTaskContext'):
        require(token not in APP_SOURCE, f"app.js に廃止したタスク処理を残さないでください: {token}")

    require('taskInput' not in SHORTCUTS_SOURCE, "タスク入力専用ショートカットを残さないでください")
    require('.task-card' not in STYLES_SOURCE, "タスクカード専用CSSを残さないでください")

    require("const LEGACY_TASK_STORAGE_KEYS = ['one.task', 'one.taskDate.v1'];" in STORAGE_SOURCE,
            "旧バージョンのタスク保存値は移行時に削除してください")
    require("LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));" in STORAGE_SOURCE,
            "旧タスク保存値を既知キー単位で削除してください")
    require('localStorage.clear(' not in STORAGE_SOURCE, "旧データ削除でlocalStorage.clear()を使わないでください")

    require('<title>ONE — 集中タイマー</title>' in INDEX_SOURCE, "ページタイトルをタイマー用途に合わせてください")
    require('<span class="step">01</span>\n        <h2 id="timer-title">' in INDEX_SOURCE,
            "タイマーを最初のステップとして表示してください")
    require('<span class="step">02</span>\n        <h2 id="done-title">' in INDEX_SOURCE,
            "集中記録を2番目のステップとして表示してください")
    require('<span class="step">03</span>\n        <h2 id="backup-title">' in INDEX_SOURCE,
            "バックアップを3番目のステップとして表示してください")

    print("Timer-only checks passed: task planning is removed while timer, records, and legacy cleanup remain.")


if __name__ == "__main__":
    main()
