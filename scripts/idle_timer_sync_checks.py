from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TAB_GUARD_PATH = ROOT / "src" / "features" / "timer" / "tabGuard.js"
TIMER_STORE_PATH = ROOT / "src" / "features" / "timer" / "timerStore.js"
CUSTOM_TIMER_HOOK_PATH = ROOT / "src" / "features" / "timer" / "useCustomTimerControl.js"


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
    timer_store = TIMER_STORE_PATH.read_text(encoding="utf-8")
    custom_timer = CUSTOM_TIMER_HOOK_PATH.read_text(encoding="utf-8")

    parse_idle = section(tab_guard, "function parseIdleTimerState", "function syncIdleTimerFromStorage")
    require("ONE_TIMER_STATE_GUARD?.parse(raw)" in parse_idle,
            "別タブのタイマー保存値は共通検証器で検証してください")
    require("state.running === true" in parse_idle, "実行中の保存状態は同期対象外にしてください")
    require("state.completionReady === true" in parse_idle, "未記録の完了状態は同期対象外にしてください")
    require("state.remainingSeconds !== fullDuration" in parse_idle,
            "全時間が残っているアイドル状態だけ同期してください")

    sync_idle = section(tab_guard, "function syncIdleTimerFromStorage", "function refreshGuardProgressFromStorage")
    require("hasLocalTimerContext()" in sync_idle,
            "ローカルに進行中・一時停止・完了待ちがあるときは同期しないでください")
    require("storageCoordinationUnavailable()" in sync_idle,
            "保存障害中はタイマー同期を行わないでください")
    require("timerRuntime.syncIdleState?.(state) === true" in sync_idle,
            "検証済みのアイドル状態だけReactタイマーruntimeへ渡してください")
    require("safeWrite(" not in sync_idle,
            "別タブ同期から保存値を書き戻さないでください")

    store_sync = section(timer_store, "function syncIdleState(state)", "function clearPendingCompletion")
    require("state.remainingSeconds !== fullDuration" in store_sync,
            "Reactタイマーruntimeでも全時間アイドル状態だけ受け入れてください")
    require("persist: true" not in store_sync and "persistTimerState" not in store_sync,
            "別タブ同期をlocalStorageへ書き戻さないでください")
    require("one:idle-timer-sync" in store_sync,
            "自由設定UIへアイドル同期イベントを通知してください")

    custom_sync = section(custom_timer, "function handleIdleTimerSync(event)", "window.addEventListener('one:idle-timer-sync'")
    require("event.detail?.selectedMinutes" in custom_sync,
            "同期イベントの分数を取得してください")
    require("parseMinutes(minutes) === null" in custom_sync,
            "自由設定範囲をReact側でも再確認してください")
    require("setValue(String(minutes))" in custom_sync,
            "自由設定入力欄へ同期値を反映してください")
    require("別のタブで${minutes}分に変更されました。" in custom_sync,
            "別タブ変更を利用者へ通知してください")
    require("localStorage" not in custom_sync,
            "React UI同期から保存値を書き戻さないでください")

    require("timerActions.selectMinutes(minutes)" in custom_timer,
            "Reactの分数変更はtimerStoreへ集約してください")
    require("currentState.completionReady" in timer_store,
            "未記録完了中はtimerStoreで分数変更を拒否してください")
    require(not (ROOT / "legacy" / "interop" / "timer.js").exists(),
            "timer interopは削除したままにしてください")

    print("Idle timer settings sync through the module timer guard without storage write-back.")


if __name__ == "__main__":
    main()
