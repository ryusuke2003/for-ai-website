from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
STATS_SOURCE = (ROOT / "stats.js").read_text(encoding="utf-8")
RESET_SOURCE = (ROOT / "privacy-reset.js").read_text(encoding="utf-8")


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
    require('id="daily-goal-input"' in INDEX_SOURCE, "今日の目標入力欄を維持してください")
    require('min="1" max="12" step="1"' in INDEX_SOURCE, "今日の目標は1〜12回の整数に制限してください")
    require('id="daily-goal-apply"' in INDEX_SOURCE, "今日の目標設定ボタンを維持してください")
    require('id="daily-goal-clear"' in INDEX_SOURCE and "hidden>目標を解除" in INDEX_SOURCE, "未設定時は目標解除ボタンを隠してください")
    require(
        'id="daily-goal-status" role="status" aria-live="polite"' in INDEX_SOURCE,
        "今日の目標状態は支援技術へ穏やかに通知してください",
    )
    require("今日の目標は未設定です。1〜12回で設定できます。" in INDEX_SOURCE, "初期状態では目標を強制しないでください")

    require("const DAILY_GOAL_STORAGE_KEY = 'one.dailyGoal.v1';" in STATS_SOURCE, "今日の目標保存キーを変更しないでください")
    require("const MIN_DAILY_GOAL = 1;" in STATS_SOURCE and "const MAX_DAILY_GOAL = 12;" in STATS_SOURCE, "今日の目標範囲を1〜12回に維持してください")

    parser = section(STATS_SOURCE, "function parseDailyGoalState(raw)", "function removeStoredDailyGoal(expectedRaw)")
    for token in (
        "raw.length > MAX_DAILY_GOAL_STATE_BYTES",
        "JSON.parse(raw)",
        "Object.keys(value).length !== 2",
        "Object.hasOwn(value, 'date')",
        "Object.hasOwn(value, 'goal')",
        "isValidDateKey(value.date)",
        "Number.isInteger(value.goal)",
        "value.goal < MIN_DAILY_GOAL",
        "value.goal > MAX_DAILY_GOAL",
    ):
        require(token in parser, f"保存済み目標の厳格検証に {token} が必要です")

    remover = section(STATS_SOURCE, "function removeStoredDailyGoal(expectedRaw)", "function loadDailyGoal()")
    current_read = remover.find("localStorage.getItem(DAILY_GOAL_STORAGE_KEY)")
    mismatch_guard = remover.find("expectedRaw !== undefined && current !== expectedRaw")
    delete_position = remover.find("localStorage.removeItem(DAILY_GOAL_STORAGE_KEY);")
    verify_position = remover.rfind("localStorage.getItem(DAILY_GOAL_STORAGE_KEY) === null")
    require(min(current_read, mismatch_guard, delete_position, verify_position) >= 0, "目標削除の競合保護・削除・確認を維持してください")
    require(current_read < mismatch_guard < delete_position < verify_position, "目標削除前に現在値が想定値のままか確認してください")
    require("if (expectedRaw !== undefined && current !== expectedRaw) return true;" in remover, "別タブが新しい目標へ更新済みなら古い値として削除しないでください")
    require("reportStorageFailure();" in remover, "目標削除失敗はアプリ全体へ通知してください")

    loader = section(STATS_SOURCE, "function loadDailyGoal()", "function persistDailyGoal(goal)")
    require("const raw = safeRead(DAILY_GOAL_STORAGE_KEY);" in loader, "保存値を一度読み取ってから検証してください")
    require("if (storageAccessFailed || raw === '') return;" in loader, "保存失敗または未設定なら期限切れ掃除を行わないでください")
    require("const state = parseDailyGoalState(raw);" in loader, "保存済み目標は共通検証後に読み込んでください")
    require("if (!state || state.date !== dateKey())" in loader, "壊れた値や別日の目標を今日へ持ち越さないでください")
    require("removeStoredDailyGoal(raw)" in loader, "期限切れまたは壊れた保存値は読んだ値と一致する場合だけ削除してください")
    require("期限切れまたは不正な目標データを端末から削除できませんでした" in loader, "自動掃除に失敗した場合は利用者へ明示してください")

    persist = section(STATS_SOURCE, "function persistDailyGoal(goal)", "function clearExpiredDailyGoal()")
    write_position = persist.find("safeWrite(DAILY_GOAL_STORAGE_KEY, payload)")
    read_position = persist.find("safeRead(DAILY_GOAL_STORAGE_KEY)")
    mismatch_position = persist.find("reportStorageFailure();")
    require(min(write_position, read_position, mismatch_position) >= 0, "目標保存の書き込み・読み戻し・失敗通知を維持してください")
    require(write_position < read_position < mismatch_position, "目標は保存後に読み戻して一致確認してください")
    require("JSON.stringify({ date: dateKey(), goal })" in persist, "目標には設定日を一緒に保存してください")

    expiry = section(STATS_SOURCE, "function clearExpiredDailyGoal()", "function todayFocusCount()")
    require("dailyGoalDate === dateKey()" in expiry, "日付が変わるまでは当日の目標を維持してください")
    require("dailyGoal = null;" in expiry and "dailyGoalDate = null;" in expiry, "日付変更時は前日のメモリ上の目標を解除してください")
    require("dailyGoalInput.value = '';" in expiry, "日付変更時は目標入力欄も未設定へ戻してください")
    require("loadDailyGoal();" in expiry, "日付変更後は保存値を再確認して期限切れデータを掃除し、別タブの今日の目標があれば採用してください")
    require("removeStoredDailyGoal(" not in expiry, "日付変更時に保存値を確認せず直接削除しないでください")

    renderer = section(STATS_SOURCE, "function renderDailyGoal()", "function parseDailyGoalInput()")
    require("Math.max(dailyGoal - today, 0)" in renderer, "目標までの残り回数を負数にしないでください")
    require("今日の目標 ${dailyGoal}回を達成しました" in renderer, "目標達成を明示してください")
    require("あと${remaining}回" in renderer, "未達成時は残り回数を表示してください")
    require("todayCount.setAttribute(" in renderer and "aria-label" in renderer, "今日の回数へ目標進捗の読み上げを追加してください")

    input_parser = section(STATS_SOURCE, "function parseDailyGoalInput()", "function applyDailyGoal()")
    require("Number.isInteger(value)" in input_parser, "小数の目標を受け付けないでください")
    require("value >= MIN_DAILY_GOAL" in input_parser and "value <= MAX_DAILY_GOAL" in input_parser, "入力値も1〜12回に制限してください")

    apply = section(STATS_SOURCE, "function applyDailyGoal()", "function clearDailyGoal()")
    require("dailyGoalInput.setAttribute('aria-invalid', 'true');" in apply, "不正な目標入力をaria-invalidで示してください")
    require("dailyGoalDate = dateKey();" in apply, "設定した目標へ今日の日付を紐付けてください")
    require("persistDailyGoal(nextGoal)" in apply, "目標設定を端末へ保存してください")
    require("端末へ保存できませんでした" in apply, "保存失敗時は現在タブだけの設定だと説明してください")

    clear = section(STATS_SOURCE, "function clearDailyGoal()", "function syncDailyGoalFromStorage(event)")
    require("removeStoredDailyGoal()" in clear, "利用者が目標解除を選んだ場合は現在の保存値を削除してください")

    sync = section(STATS_SOURCE, "function syncDailyGoalFromStorage(event)", "function renderProgressInsights()")
    require("event.key !== DAILY_GOAL_STORAGE_KEY" in sync, "目標キー以外のstorageイベントを無視してください")
    require("event.newValue === null" in sync, "別タブからの目標解除を同期してください")
    require("parseDailyGoalState(event.newValue)" in sync, "別タブの目標も厳格検証してください")
    require("state.date !== dateKey()" in sync, "別日の目標を別タブ同期で持ち越さないでください")
    require("safeWrite(" not in sync and "localStorage.setItem(" not in sync and "removeStoredDailyGoal(" not in sync, "storage同期から保存を書き換えてイベントループを作らないでください")

    require("window.addEventListener('storage', syncDailyGoalFromStorage);" in STATS_SOURCE, "今日の目標を別タブへ同期してください")
    require("renderDailyGoal();" in section(STATS_SOURCE, "function renderProgressInsights()", "loadDailyGoal();"), "集中記録更新時に目標進捗も再描画してください")
    require("'one.dailyGoal.v1'," in RESET_SOURCE, "プライバシーリセットで今日の目標も削除してください")
    require("今日の目標" in INDEX_SOURCE.split('id="data-reset-hint"', 1)[-1], "端末データ削除の説明に今日の目標を含めてください")

    print("Daily focus goal checks passed, including safe expiry cleanup and cross-tab race protection.")


if __name__ == "__main__":
    main()
