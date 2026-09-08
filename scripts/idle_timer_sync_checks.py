from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TAB_GUARD_PATH = ROOT / "tab-guard.js"
CUSTOM_TIMER_PATH = ROOT / "custom-timer.js"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    require(start >= 0, f"{start_marker} が見つかりません")
    end = source.find(end_marker, start)
    require(end > start, f"{end_marker} が見つかりません")
    return source[start:end]


def main():
    tab_guard = TAB_GUARD_PATH.read_text(encoding="utf-8")
    custom_timer = CUSTOM_TIMER_PATH.read_text(encoding="utf-8")

    parse_idle = section(tab_guard, "function parseIdleTimerState", "function syncIdleTimerFromStorage")
    require(
        "ONE_TIMER_STATE_GUARD?.parse(raw)" in parse_idle,
        "別タブのタイマー保存値は共通検証器で検証してください",
    )
    require("state.running === true" in parse_idle, "実行中の保存状態は同期対象外にしてください")
    require("state.completionReady === true" in parse_idle, "未記録の完了状態は同期対象外にしてください")
    require(
        "state.remainingSeconds !== fullDuration" in parse_idle,
        "全時間が残っているアイドル状態だけ同期してください",
    )

    sync_idle = section(tab_guard, "function syncIdleTimerFromStorage", "function refreshGuardProgressFromStorage")
    require("hasLocalTimerContext()" in sync_idle, "ローカルに進行中・一時停止・完了待ちがあるときは同期しないでください")
    require("storageCoordinationUnavailable()" in sync_idle, "保存障害中はタイマー同期を行わないでください")
    require("selectedMinutes = state.selectedMinutes;" in sync_idle, "検証済みの選択時間を反映してください")
    require("remainingSeconds = state.remainingSeconds;" in sync_idle, "検証済みの残り時間を反映してください")
    require("renderTimer();" in sync_idle, "同期後にタイマー表示を更新してください")
    require("one:idle-timer-sync" in sync_idle, "自由設定UIへ同期イベントを通知してください")
    require("safeWrite(" not in sync_idle, "別タブ同期からlocalStorageへ書き戻さないでください")
    require("saveTimerState(" not in sync_idle, "別タブ同期からタイマー状態を再保存しないでください")

    storage_handler = section(
        tab_guard,
        "window.addEventListener('storage'",
        "window.addEventListener('one:storage-error'",
    )
    timer_branch = storage_handler.find("event.key === STORAGE_KEYS.timer")
    sync_call = storage_handler.find("syncIdleTimerFromStorage(event.newValue)", timer_branch)
    return_after_sync = storage_handler.find("return;", sync_call)
    require(min(timer_branch, sync_call, return_after_sync) >= 0, "タイマー保存イベントの同期分岐を確認できません")
    require(timer_branch < sync_call < return_after_sync, "タイマー保存イベントは同期後に他の分岐へ流さないでください")
    require("safeRead(STORAGE_KEYS.timer" not in storage_handler, "storageイベントではevent.newValueを直接検証してください")

    custom_sync = section(
        custom_timer,
        "window.addEventListener('one:idle-timer-sync'",
        "const customTimerLockObserver",
    )
    require("event.detail?.selectedMinutes" in custom_sync, "同期イベントの分数を検証してください")
    require("isAllowedCustomTimerMinutes(minutes)" in custom_sync, "自由設定範囲を再確認してください")
    require("customPresetButton.dataset.minutes = String(minutes);" in custom_sync, "自由設定プリセットにも同期値を反映してください")
    require("syncCustomTimerPresentation();" in custom_sync, "自由設定入力欄とプリセット表示を同期してください")
    require("safeWrite(" not in custom_sync, "自由設定UI同期から保存値を書き戻さないでください")

    print("Idle timer settings sync across tabs without overwriting active sessions or writing back storage.")


if __name__ == "__main__":
    main()
