from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def main():
    start = APP_SOURCE.find("function loadDailyTask")
    end = APP_SOURCE.find("function normalizeHistory", start)
    if start < 0 or end < 0:
        fail("loadDailyTask() の範囲を確認できません")

    body = APP_SOURCE[start:end]
    task_read = body.find("safeRead(STORAGE_KEYS.task)")
    date_read = body.find("safeRead(STORAGE_KEYS.taskDate)")
    first_task_write = body.find("taskInput.value")
    first_guard = body.find("if (storageAccessFailed) return;")

    if min(task_read, date_read, first_task_write, first_guard) < 0:
        fail("タスク保存失敗時の保護に必要な処理が見つかりません")
    if first_guard > task_read:
        fail("既知の保存エラーがある場合はタスク保存値を読む前に処理を止めてください")

    guard_after_task_read = body.find("if (storageAccessFailed) return;", task_read)
    if guard_after_task_read < 0 or guard_after_task_read > date_read:
        fail("タスク本文の読み込み失敗を確認してから日付を読んでください")

    guard_after_date_read = body.find("if (storageAccessFailed) return;", date_read)
    if guard_after_date_read < 0 or guard_after_date_read > first_task_write:
        fail("タスク日付の読み込み失敗を確認してから入力欄を書き換えてください")

    if "taskInput.addEventListener('beforeinput', refreshDateSensitiveUi);" not in APP_SOURCE:
        fail("beforeinput の日付同期経路を変更する場合は保存失敗時の入力保持を再確認してください")

    print("Task storage failure checks passed.")


if __name__ == "__main__":
    main()
