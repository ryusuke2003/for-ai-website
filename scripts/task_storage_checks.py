from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP_SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")
STORAGE_STATUS_SOURCE = (ROOT / "storage-status.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


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

    require(
        "taskInput.addEventListener('beforeinput', refreshDateSensitiveUi);" in APP_SOURCE,
        "beforeinput の日付同期経路を変更する場合は保存失敗時の入力保持を再確認してください",
    )

    input_start = APP_SOURCE.find("taskInput.addEventListener('input', () => {")
    input_end = APP_SOURCE.find("});", input_start)
    if input_start < 0 or input_end < 0:
        fail("タスク入力の保存処理を確認できません")
    input_body = APP_SOURCE[input_start:input_end]
    require(
        "safeWrite(STORAGE_KEYS.task, taskInput.value.slice(0, 120));" in input_body,
        "入力したタスク本文は120文字以内で保存してください",
    )
    require(
        "safeWrite(STORAGE_KEYS.taskDate, dateKey());" in input_body,
        "タスク入力時に保存日も更新してください",
    )

    require(
        "const taskStorageStatus = document.createElement('p');" in STORAGE_STATUS_SOURCE,
        "タスク入力の近くに保存失敗用ステータスを用意してください",
    )
    require(
        "taskStorageStatus.setAttribute('role', 'status');" in STORAGE_STATUS_SOURCE
        and "taskStorageStatus.setAttribute('aria-live', 'polite');" in STORAGE_STATUS_SOURCE,
        "タスク保存失敗は支援技術へ穏やかに通知してください",
    )
    require(
        "taskInput.after(taskStorageStatus);" in STORAGE_STATUS_SOURCE
        and "taskInput.setAttribute('aria-describedby', taskStorageStatus.id);" in STORAGE_STATUS_SOURCE,
        "保存失敗の案内をタスク入力の直後へ置き、入力欄から参照してください",
    )

    feedback_start = STORAGE_STATUS_SOURCE.find("function revealTaskStorageFailureIfNeeded()")
    feedback_end = STORAGE_STATUS_SOURCE.find("window.addEventListener('one:storage-error'", feedback_start)
    if feedback_start < 0 or feedback_end < 0:
        fail("タスク保存失敗の表示処理を確認できません")
    feedback = STORAGE_STATUS_SOURCE[feedback_start:feedback_end]
    require(
        "if (!storageAccessFailed) return;" in feedback,
        "保存が正常な入力ではタスク保存警告を出さないでください",
    )
    require(
        "taskStorageStatus.textContent === TASK_STORAGE_FAILURE_MESSAGE" in feedback,
        "同じ保存失敗メッセージを毎キー入力で再通知しないでください",
    )
    require(
        "taskStorageStatus.textContent = TASK_STORAGE_FAILURE_MESSAGE;" in feedback,
        "保存失敗時はタスク入力の近くへ案内を表示してください",
    )
    require(
        "再読み込みすると内容が失われる可能性があります。" in STORAGE_STATUS_SOURCE,
        "保存失敗時は再読み込みによる内容消失の可能性を明示してください",
    )
    require(
        "taskInput.addEventListener('input', revealTaskStorageFailureIfNeeded);" in STORAGE_STATUS_SOURCE,
        "app.js の保存処理後にタスク入力の保存結果を案内してください",
    )
    require(
        ".innerHTML" not in STORAGE_STATUS_SOURCE,
        "タスク保存案内の生成にinnerHTMLを使わないでください",
    )

    print("Task storage failure checks preserve input and surface persistence failures without repeated announcements.")


if __name__ == "__main__":
    main()
