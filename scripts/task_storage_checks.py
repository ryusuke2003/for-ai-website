from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
APP_SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")
STORAGE_STATUS_SOURCE = (ROOT / "storage-status.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        fail(f"{start_marker} が見つかりません")
    end = source.find(end_marker, start)
    if end < 0:
        fail(f"{end_marker} が見つかりません")
    return source[start:end]


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

    task_input_start = INDEX_SOURCE.find('<input id="task-input"')
    task_input_end = INDEX_SOURCE.find('>', task_input_start)
    if task_input_start < 0 or task_input_end < 0:
        fail("#task-input が見つかりません")
    task_input_tag = INDEX_SOURCE[task_input_start:task_input_end + 1]
    require('maxlength="120"' in task_input_tag, "タスク入力は120文字上限を維持してください")
    require(
        'aria-describedby="task-character-count"' in task_input_tag,
        "タスク入力は初期状態で文字数案内を参照してください",
    )

    counter_start = INDEX_SOURCE.find('<p class="hint" id="task-character-count"')
    counter_end = INDEX_SOURCE.find('</p>', counter_start)
    if counter_start < 0 or counter_end < 0:
        fail("#task-character-count が見つかりません")
    counter_markup = INDEX_SOURCE[counter_start:counter_end + 4]
    require("あと120文字" in counter_markup, "文字数案内の初期値は120文字にしてください")
    require("aria-live" not in counter_markup, "文字数案内を毎キー入力でaria-live通知しないでください")

    require(
        "const taskCharacterCount = document.querySelector('#task-character-count');" in STORAGE_STATUS_SOURCE,
        "文字数案内要素を取得してください",
    )
    counter_body = section(
        STORAGE_STATUS_SOURCE,
        "function updateTaskCharacterCount()",
        "function revealTaskStorageFailureIfNeeded()",
    )
    for token in (
        "taskInput.maxLength",
        "taskInput.value.length",
        "Math.max(0, maxLength - taskInput.value.length)",
        "taskCharacterCount.textContent = `あと${remaining}文字`;",
    ):
        require(token in counter_body, f"文字数更新に必要な処理がありません: {token}")

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
        "taskCharacterCount.after(taskStorageStatus);" in STORAGE_STATUS_SOURCE,
        "保存失敗の案内は文字数案内の直後へ置いてください",
    )
    require(
        "taskInput.getAttribute('aria-describedby')" in STORAGE_STATUS_SOURCE
        and "taskDescriptionIds.add(taskStorageStatus.id);" in STORAGE_STATUS_SOURCE
        and "taskInput.setAttribute('aria-describedby', [...taskDescriptionIds].join(' '));" in STORAGE_STATUS_SOURCE,
        "既存の文字数案内を消さずに保存失敗ステータスもaria-describedbyへ追加してください",
    )
    require(
        "taskInput.setAttribute('aria-describedby', taskStorageStatus.id);" not in STORAGE_STATUS_SOURCE,
        "保存失敗ステータスだけでaria-describedbyを上書きしないでください",
    )

    feedback_start = STORAGE_STATUS_SOURCE.find("function revealTaskStorageFailureIfNeeded()")
    feedback_end = STORAGE_STATUS_SOURCE.find("function taskSyncBlocked()", feedback_start)
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

    sync_block = section(
        STORAGE_STATUS_SOURCE,
        "function taskSyncBlocked()",
        "function syncTaskFromStorage",
    )
    require(
        "document.activeElement === taskInput" in sync_block,
        "入力中のタスクを別タブ更新で上書きしないでください",
    )
    require(
        "hasActiveDailyTaskContext()" in sync_block,
        "進行中・一時停止中・未記録完了中のタスクを別タブ更新で差し替えないでください",
    )

    task_sync = section(
        STORAGE_STATUS_SOURCE,
        "function syncTaskFromStorage",
        "function handleTaskInput()",
    )
    date_sync_read = task_sync.find("safeRead(STORAGE_KEYS.taskDate)")
    date_sync_guard = task_sync.find("if (storageAccessFailed) return false;", date_sync_read)
    today_guard = task_sync.find("if (storedTaskDate !== dateKey()) return false;")
    task_sync_read = task_sync.find("safeRead(STORAGE_KEYS.task)")
    task_sync_guard = task_sync.find("if (storageAccessFailed) return false;", task_sync_read)
    task_write = task_sync.find("taskInput.value = nextTask;")
    counter_write = task_sync.find("updateTaskCharacterCount();", task_write)
    require(
        min(date_sync_read, date_sync_guard, today_guard, task_sync_read, task_sync_guard, task_write, counter_write) >= 0,
        "別タブのタスク同期に必要な検証処理が見つかりません",
    )
    require(
        date_sync_read < date_sync_guard < today_guard < task_sync_read < task_sync_guard < task_write < counter_write,
        "別タブ同期は保存日確認→本文読込→保存障害確認→入力反映→文字数更新の順にしてください",
    )
    require(
        "storedTask.slice(0, maxLength)" in task_sync,
        "別タブから受けたタスクも入力欄の文字数上限へ収めてください",
    )
    require(
        "TASK_REMOTE_UPDATE_PENDING_MESSAGE" in task_sync
        and "TASK_REMOTE_UPDATE_APPLIED_MESSAGE" in task_sync,
        "別タブ更新を保留した場合と反映した場合を利用者へ区別して案内してください",
    )
    require(
        "safeWrite(" not in task_sync
        and "localStorage.setItem" not in task_sync
        and "localStorage.removeItem" not in task_sync,
        "別タブ同期処理から保存値を書き戻さないでください",
    )

    input_feedback = section(
        STORAGE_STATUS_SOURCE,
        "function handleTaskInput()",
        "window.addEventListener('one:storage-error'",
    )
    require(
        input_feedback.find("updateTaskCharacterCount();") < input_feedback.find("revealTaskStorageFailureIfNeeded();"),
        "入力時は文字数を更新してから保存失敗表示を確認してください",
    )
    require(
        "TASK_REMOTE_UPDATE_PENDING_MESSAGE" in input_feedback
        and "TASK_REMOTE_UPDATE_APPLIED_MESSAGE" in input_feedback,
        "現在タブで再入力した場合は古い別タブ同期メッセージを残さないでください",
    )

    storage_sync = section(
        STORAGE_STATUS_SOURCE,
        "window.addEventListener('storage', (event) => {",
        "taskInput.addEventListener('input', handleTaskInput);",
    )
    require(
        "event.key !== STORAGE_KEYS.task && event.key !== STORAGE_KEYS.taskDate" in storage_sync,
        "タスク本文または保存日の変更だけを別タブ同期してください",
    )
    require(
        "syncTaskFromStorage();" in storage_sync,
        "タスク関連のstorageイベントで安全な同期処理を呼んでください",
    )
    require(
        "safeWrite(" not in storage_sync and "localStorage.setItem" not in storage_sync,
        "storageイベントから保存値を書き戻さないでください",
    )

    require(
        "taskInput.addEventListener('input', handleTaskInput);" in STORAGE_STATUS_SOURCE,
        "app.js の保存処理後に文字数と保存結果を更新してください",
    )
    require(
        "taskInput.addEventListener('focus', updateTaskCharacterCount);" in STORAGE_STATUS_SOURCE,
        "入力欄へ戻った場合も文字数を再同期してください",
    )
    require(
        "taskInput.addEventListener('blur', () => {" in STORAGE_STATUS_SOURCE
        and "syncTaskFromStorage();" in STORAGE_STATUS_SOURCE,
        "入力を終えたら保留していた別タブ更新を再確認してください",
    )
    require(
        "window.addEventListener('focus', () => {" in STORAGE_STATUS_SOURCE
        and "syncTaskFromStorage({ announce: false });" in STORAGE_STATUS_SOURCE,
        "ウィンドウへ戻った場合は静かに端末保存の最新タスクを再確認してください",
    )
    require(
        "document.visibilityState !== 'visible'" in STORAGE_STATUS_SOURCE,
        "タブが前面へ戻った場合だけタスクを再確認してください",
    )
    require(
        "[resetButton, doneButton, discardButton].forEach" in STORAGE_STATUS_SOURCE,
        "集中セッションを終えられる操作後に保留タスクを再確認してください",
    )
    require(
        STORAGE_STATUS_SOURCE.rfind("updateTaskCharacterCount();") < STORAGE_STATUS_SOURCE.rfind("setStorageHealth(probeLocalStorage());"),
        "初期表示でも保存済みタスクの文字数を反映してください",
    )
    require(
        ".innerHTML" not in STORAGE_STATUS_SOURCE,
        "タスク保存案内や文字数表示の生成にinnerHTMLを使わないでください",
    )

    print("Task storage checks preserve active input while safely synchronizing idle task updates across tabs.")


if __name__ == "__main__":
    main()
