from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TAB_GUARD_PATH = ROOT / "tab-guard.js"
CUSTOM_TIMER_HOOK_PATH = ROOT / "src" / "features" / "timer" / "useCustomTimerControl.js"
TIMER_INTEROP_PATH = ROOT / "legacy" / "interop" / "timer.js"


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
    custom_timer = CUSTOM_TIMER_HOOK_PATH.read_text(encoding="utf-8")
    timer_interop = TIMER_INTEROP_PATH.read_text(encoding="utf-8")

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
    require("selectedMinutes = state.selectedMinutes;" in sync_idle,
            "検証済みの選択時間を反映してください")
    require("remainingSeconds = state.remainingSeconds;" in sync_idle,
            "検証済みの残り時間を反映してください")
    require("renderTimer();" in sync_idle, "同期後にタイマー状態を更新してください")
    require("one:idle-timer-sync" in sync_idle, "React自由設定UIへ同期イベントを通知してください")
    require("safeWrite(" not in sync_idle and "saveTimerState(" not in sync_idle,
            "別タブ同期から保存値を書き戻さないでください")

    custom_sync = section(custom_timer, "function handleIdleTimerSync(event)", "window.addEventListener('one:idle-timer-sync'")
    require("event.detail?.selectedMinutes" in custom_sync,
            "同期イベントの分数を取得してください")
    require("parseMinutes(minutes) === null" in custom_sync,
            "自由設定範囲をReact側でも再確認してください")
    require("setValue(String(minutes))" in custom_sync,
            "自由設定入力欄へ同期値を反映してください")
    require("別のタブで${minutes}分に変更されました。" in custom_sync,
            "別タブ変更を利用者へ通知してください")
    require("localStorage" not in custom_sync and "safeWrite(" not in custom_sync,
            "React UI同期から保存値を書き戻さないでください")

    require("selectMinutes(minutes)" in timer_interop,
            "Reactの分数変更をtimer interopへ集約してください")
    require("legacyCustomPreset.dataset.minutes = String(minutes);" in timer_interop,
            "任意の分数はhidden custom presetへ反映して既存timer処理へ渡してください")
    require("completionReady" in timer_interop,
            "未記録完了中は分数変更を拒否してください")

    print("Idle timer settings sync across tabs while custom duration UI is owned by React.")


if __name__ == "__main__":
    main()
