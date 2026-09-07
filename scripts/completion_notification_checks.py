from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOUND_PATH = ROOT / "completion-sound.js"
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
    source = SOUND_PATH.read_text(encoding="utf-8")
    index = INDEX_PATH.read_text(encoding="utf-8")
    privacy_reset = PRIVACY_RESET_PATH.read_text(encoding="utf-8")

    require('id="completion-notification-toggle"' in index, "完了通知トグルをHTMLに置いてください")
    require('id="completion-notification-status"' in index, "完了通知の状態表示をHTMLに置いてください")
    require(
        'id="completion-notification-toggle" type="button" aria-pressed="false"' in index,
        "完了通知は初期HTMLでOFFにしてください",
    )

    require(
        "COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1'" in source,
        "完了通知の保存キーを維持してください",
    )
    require(
        "parseCompletionNotificationPreference(safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY)) === true" in source,
        "保存値は厳格に検証してから完了通知をONへ復元してください",
    )

    persist = section(
        source,
        "function persistCompletionNotificationPreference",
        "function getCompletionAudioContext",
    )
    require(
        "safeWrite(COMPLETION_NOTIFICATION_STORAGE_KEY, value)" in persist,
        "完了通知設定はsafeWriteで保存してください",
    )
    require(
        "safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY) === value" in persist,
        "完了通知設定は保存後に読み戻してください",
    )

    enable = section(source, "async function enableCompletionNotification", "function disableCompletionNotification")
    require("Notification.requestPermission()" in enable, "通知権限は明示的なON操作時だけ要求してください")
    require("permission !== 'granted'" in enable, "通知が許可されなければONにしないでください")
    require("completionNotificationEnabled = true;" in enable, "許可後だけ完了通知をONにしてください")

    refresh = section(
        source,
        "function refreshCompletionNotificationFromBrowser",
        "function showCompletionNotification",
    )
    require(
        "closeVisibleNotification && document.visibilityState === 'visible'" in refresh,
        "前面へ戻ったときだけ残っている完了通知を閉じてください",
    )
    require(
        "closeActiveCompletionNotification();" in refresh,
        "前面復帰時はOS側の古い完了通知を閉じてください",
    )
    permission_check = refresh.find("Notification.permission !== 'granted'")
    disable_position = refresh.find("completionNotificationEnabled = false;", permission_check)
    storage_guard = refresh.find("if (!storageAccessFailed)")
    safe_read = refresh.find("safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY)")
    post_read_guard = refresh.find("if (!storageAccessFailed)", storage_guard + 1)
    apply_stored = refresh.find("parseCompletionNotificationPreference(storedPreference) === true")
    require(permission_check >= 0, "タブ復帰時に通知権限を再確認してください")
    require(disable_position > permission_check, "権限が外れていたら完了通知を即OFFにしてください")
    require(0 <= storage_guard < safe_read, "保存障害中は設定を再読込しないでください")
    require(safe_read < post_read_guard < apply_stored, "設定読込中に保存障害が起きた場合は現在タブの状態を上書きしないでください")

    show = section(source, "function showCompletionNotification", "async function toggleCompletionSound")
    require("Notification.permission !== 'granted'" in show, "通知表示前に権限を再確認してください")
    require("document.visibilityState === 'visible'" in show, "前面タブではデスクトップ通知を出さないでください")
    require("new Notification('集中スプリント完了'" in show, "完了時だけ固定タイトルの通知を表示してください")
    require("taskInput" not in show, "通知本文へタスク本文を含めないでください")
    require("ONEで完了した集中を記録してください。" in show, "通知本文は固定文言にしてください")

    finish = section(source, "const finishTimerWithoutCompletionSound", "completionSoundToggle.addEventListener")
    require("finishTimerWithoutCompletionSound();" in finish, "本来の完了処理を先に実行してください")
    require("showCompletionNotification();" in finish, "タイマー完了後に通知判定を実行してください")

    toggle_listener = section(
        source,
        "completionNotificationToggle.addEventListener('click'",
        "document.addEventListener('pointerdown'",
    )
    require("enableCompletionNotification()" in toggle_listener, "通知権限要求は完了通知トグルから開始してください")

    storage_handler = source.split("window.addEventListener('storage'", 2)[-1]
    require("event.key !== COMPLETION_NOTIFICATION_STORAGE_KEY" in storage_handler, "別タブ同期は完了通知キーだけを対象にしてください")
    require("parseCompletionNotificationPreference(event.newValue)" in storage_handler, "別タブのnewValueを検証してください")
    require("Notification.requestPermission" not in storage_handler, "別タブ同期で通知権限を要求しないでください")
    require("safeWrite(" not in storage_handler, "別タブ同期で保存値を書き戻さないでください")

    visibility = section(
        source,
        "document.addEventListener('visibilitychange'",
        "window.addEventListener('pageshow'",
    )
    require("document.visibilityState !== 'visible'" in visibility, "背景へ移るだけでは完了通知を閉じないでください")
    require(
        "refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true })" in visibility,
        "タブへ戻った瞬間に通知と権限状態を整理してください",
    )

    pageshow = source.split("window.addEventListener('pageshow'", 1)[-1]
    require(
        "refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true })" in pageshow,
        "BFCacheなどから復元された場合も通知と権限状態を整理してください",
    )
    require("Notification.requestPermission" not in visibility, "タブ復帰だけで通知権限を要求しないでください")
    require("Notification.requestPermission" not in pageshow, "ページ復元だけで通知権限を要求しないでください")

    require("'one.completionNotification.v1'" in privacy_reset, "完了通知設定を端末データ削除対象へ含めてください")

    print("Completion notification is opt-in, permission-gated, background-only, task-private, and cleaned up on return.")


if __name__ == "__main__":
    main()
