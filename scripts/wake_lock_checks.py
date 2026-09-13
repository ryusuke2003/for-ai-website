from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HOOK_PATH = ROOT / "src" / "features" / "timer" / "useWakeLockControl.js"
SETTINGS_PATH = ROOT / "src" / "features" / "timer" / "TimerSettings.jsx"
INDEX_PATH = ROOT / "index.html"
PRIVACY_RESET_PATH = ROOT / "src" / "features" / "backup" / "usePrivacyResetControl.js"


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
    source = HOOK_PATH.read_text(encoding="utf-8")
    settings = SETTINGS_PATH.read_text(encoding="utf-8")
    index = INDEX_PATH.read_text(encoding="utf-8")
    privacy_reset = PRIVACY_RESET_PATH.read_text(encoding="utf-8")

    require('id="wake-lock-toggle"' in settings, "画面維持トグルはReact UIに置いてください")
    require('id="wake-lock-status"' in settings, "画面維持状態はReact UIに置いてください")
    require("useWakeLockControl(timerState.running)" in settings, "Wake LockはReactのタイマー実行状態へ追従してください")
    require('wake-lock.js' not in index, "classic wake-lock.js を読み込まないでください")
    require('id="wake-lock-toggle"' not in index, "runtime scaffoldにWake Lock UIを重複させないでください")

    require("WAKE_LOCK_STORAGE_KEY = 'one.wakeLock.v1'" in source, "画面維持の保存キーを維持してください")
    require("parseWakeLockPreference(localStorage.getItem(WAKE_LOCK_STORAGE_KEY))" in source, "保存値は厳格に検証してから復元してください")

    writer = section(source, "function writeWakeLockPreference", "function defaultStatus")
    write_pos = writer.find("localStorage.setItem(WAKE_LOCK_STORAGE_KEY, value)")
    read_pos = writer.find("localStorage.getItem(WAKE_LOCK_STORAGE_KEY) === value")
    report_pos = writer.find("reportStorageFailure();")
    require(min(write_pos, read_pos, report_pos) >= 0, "画面維持設定の保存・読み戻し・失敗通知を維持してください")
    require(write_pos < read_pos < report_pos, "画面維持設定は書込→読戻し→障害通知の順にしてください")

    request = section(source, "const requestWakeLock = useCallback", "const syncWakeLockWithTimer = useCallback")
    request_call = request.find("navigator.wakeLock.request('screen')")
    visibility_guard = request.find("document.visibilityState !== 'visible'")
    enabled_guard = request.find("!enabledRef.current")
    running_guard = request.find("!runningRef.current")
    post_request_guard = request.find("!enabledRef.current", request_call)
    assign_sentinel = request.find("sentinelRef.current = sentinel;", request_call)
    require(request_call >= 0, "Screen Wake Lock APIでscreenロックを取得してください")
    require(0 <= enabled_guard < request_call, "OFF時はWake Lockを要求しないでください")
    require(0 <= running_guard < request_call, "タイマー停止中はWake Lockを要求しないでください")
    require(0 <= visibility_guard < request_call, "非表示タブではWake Lockを要求しないでください")
    require(post_request_guard > request_call, "非同期取得後に最新状態を再確認してください")
    require(assign_sentinel > post_request_guard, "再確認後だけWake Lockを保持してください")
    require("await sentinel.release();" in request[post_request_guard:assign_sentinel], "取得中に状態が変わったWake Lockは即時解放してください")

    sync = section(source, "const syncWakeLockWithTimer = useCallback", "useEffect(() => {")
    require("await releaseWakeLock();" in sync, "OFF・停止・非表示時はWake Lockを解放してください")
    require("return requestWakeLock();" in sync, "条件を満たす場合だけWake Lockを取得してください")

    require("runningRef.current = timerRunning;" in source, "タイマー状態変化をWake Lockへ反映してください")
    require("document.addEventListener('visibilitychange', refreshWhenVisible);" in source, "表示状態の変化でWake Lockを再評価してください")
    require("window.addEventListener('pagehide', handlePageHide);" in source, "ページ離脱時はWake Lockを解放してください")
    require("window.addEventListener('pageshow', refreshWhenVisible);" in source, "BFCache復帰時もWake Lockを再評価してください")

    require("event.key !== WAKE_LOCK_STORAGE_KEY" in source, "別タブ同期はWake Lockキーだけを対象にしてください")
    require("parseWakeLockPreference(event.newValue)" in source, "storage eventのnewValueを検証してください")
    storage_handler = section(source, "async function handleStorage(event)", "function handlePageHide()")
    require("localStorage.getItem(WAKE_LOCK_STORAGE_KEY)" not in storage_handler, "storage eventではlocalStorageを再読込しないでください")
    require("localStorage.setItem(" not in storage_handler, "別タブ同期から保存値を書き戻さないでください")

    require("'one.wakeLock.v1'" in privacy_reset, "画面維持設定を端末データ削除対象へ含めてください")

    print("React Wake Lock stays opt-in, timer-bound, visibility-aware, and cross-tab safe.")


if __name__ == "__main__":
    main()
