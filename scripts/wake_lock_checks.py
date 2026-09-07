from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WAKE_LOCK_PATH = ROOT / "wake-lock.js"
INDEX_PATH = ROOT / "index.html"
PRIVACY_RESET_PATH = ROOT / "privacy-reset.js"


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
    source = WAKE_LOCK_PATH.read_text(encoding="utf-8")
    index = INDEX_PATH.read_text(encoding="utf-8")
    privacy_reset = PRIVACY_RESET_PATH.read_text(encoding="utf-8")

    require('id="wake-lock-toggle"' in index, "画面維持トグルをHTMLに置いてください")
    require('id="wake-lock-status"' in index, "画面維持の状態表示をHTMLに置いてください")
    require(
        'id="wake-lock-toggle" type="button" aria-pressed="false"' in index,
        "画面維持は初期HTMLでOFFにしてください",
    )
    require('<script src="wake-lock.js" defer></script>' in index, "wake-lock.js はdeferで読み込んでください")

    require("WAKE_LOCK_STORAGE_KEY = 'one.wakeLock.v1'" in source, "画面維持の保存キーを維持してください")
    require("parseWakeLockPreference(safeRead(WAKE_LOCK_STORAGE_KEY)) === true" in source, "保存値は厳格に検証してからONへ復元してください")
    require("localStorage." not in source, "画面維持設定の保存はsafeRead/safeWrite経由にしてください")

    persist = section(source, "function persistWakeLockPreference", "async function releaseWakeLock")
    require("safeWrite(WAKE_LOCK_STORAGE_KEY, value)" in persist, "画面維持設定はsafeWriteで保存してください")
    require("safeRead(WAKE_LOCK_STORAGE_KEY) === value" in persist, "画面維持設定は保存後に読み戻してください")
    require("reportStorageFailure();" in persist, "読み戻し不一致は保存障害として通知してください")

    running = section(source, "function timerIsRunningForWakeLock", "function syncWakeLockUi")
    require("timerId !== null" in running, "タイマー停止中は画面維持しないでください")
    require("endAt !== null" in running, "終了時刻のないタイマーでは画面維持しないでください")
    require("remainingSeconds > 0" in running, "完了済みタイマーでは画面維持しないでください")

    request = section(source, "async function requestWakeLock", "async function syncWakeLockWithTimer")
    request_call = request.find("navigator.wakeLock.request('screen')")
    visibility_guard = request.find("document.visibilityState !== 'visible'")
    timer_guard = request.find("!timerIsRunningForWakeLock()")
    post_request_guard = request.find(
        "if (!wakeLockEnabled || !timerIsRunningForWakeLock() || document.visibilityState !== 'visible')",
        request_call,
    )
    assign_sentinel = request.find("wakeLockSentinel = sentinel;", request_call)
    require(request_call >= 0, "Screen Wake Lock APIでscreenロックを取得してください")
    require(0 <= visibility_guard < request_call, "非表示タブではWake Lockを要求しないでください")
    require(0 <= timer_guard < request_call, "タイマー停止中はWake Lockを要求しないでください")
    require(post_request_guard > request_call, "非同期取得後にタイマー状態を再確認してください")
    require(assign_sentinel > post_request_guard, "再確認後だけWake Lockを保持してください")
    require("await sentinel.release();" in request[post_request_guard:assign_sentinel], "取得中に状態が変わったWake Lockは即時解放してください")

    sync = section(source, "async function syncWakeLockWithTimer", "async function toggleWakeLock")
    release_position = sync.find("await releaseWakeLock();")
    request_position = sync.find("return requestWakeLock();")
    require(release_position >= 0, "OFF・停止・非表示時はWake Lockを解放してください")
    require(request_position > release_position, "解放条件を確認してからWake Lockを取得してください")

    require("wakeLockTimerObserver.observe(timerCard" in source, "タイマー状態変化へ画面維持を追従させてください")
    require("document.addEventListener('visibilitychange'" in source, "表示状態の変化でWake Lockを再評価してください")
    require("window.addEventListener('pagehide'" in source, "ページ離脱時はWake Lockを解放してください")

    storage_handler = source.split("window.addEventListener('storage'", 1)[-1]
    require("event.key !== WAKE_LOCK_STORAGE_KEY" in storage_handler, "別タブ同期は画面維持キーだけを対象にしてください")
    require("parseWakeLockPreference(event.newValue)" in storage_handler, "別タブのnewValueを検証して同期してください")
    require("safeWrite(" not in storage_handler, "別タブ同期時に設定を書き戻してイベントループを作らないでください")

    require("'one.wakeLock.v1'" in privacy_reset, "画面維持設定を端末データ削除対象へ含めてください")

    print("Wake Lock is opt-in, timer-scoped, visibility-aware, and privacy-reset compatible.")


if __name__ == "__main__":
    main()
