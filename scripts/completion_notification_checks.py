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
        "COMPLETION_EFFECT_CLAIM_STORAGE_KEY = 'one.completionEffectClaim.v1'" in source,
        "完了副作用のタブ間claimキーを維持してください",
    )
    require(
        "parseCompletionNotificationPreference(safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY)) === true" in source,
        "保存値は厳格に検証してから完了通知をONへ復元してください",
    )

    persist = section(source, "function persistCompletionNotificationPreference", "function getCompletionAudioContext")
    require("safeWrite(COMPLETION_NOTIFICATION_STORAGE_KEY, value)" in persist, "完了通知設定はsafeWriteで保存してください")
    require("safeRead(COMPLETION_NOTIFICATION_STORAGE_KEY) === value" in persist, "完了通知設定は保存後に読み戻してください")

    enable = section(source, "async function enableCompletionNotification", "function disableCompletionNotification")
    require("Notification.requestPermission()" in enable, "通知権限は明示的なON操作時だけ要求してください")
    require("permission !== 'granted'" in enable, "通知が許可されなければONにしないでください")
    require("completionNotificationEnabled = true;" in enable, "許可後だけ完了通知をONにしてください")

    refresh = section(source, "function refreshCompletionNotificationFromBrowser", "function canShowCompletionNotification")
    require("closeVisibleNotification && document.visibilityState === 'visible'" in refresh, "前面へ戻ったときだけ残っている完了通知を閉じてください")
    require("closeActiveCompletionNotification();" in refresh, "前面復帰時はOS側の古い完了通知を閉じてください")
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

    eligibility = section(source, "function canShowCompletionNotification", "function showCompletionNotification")
    require("Notification.permission === 'granted'" in eligibility, "通知表示前に権限を再確認してください")
    require("document.visibilityState !== 'visible'" in eligibility, "前面タブではデスクトップ通知を出さないでください")

    show = section(source, "function showCompletionNotification", "function completionEffectClaimPayload")
    require("canShowCompletionNotification()" in show, "通知生成直前にも表示条件を再確認してください")
    require("new Notification('集中スプリント完了'" in show, "完了時だけ固定タイトルの通知を表示してください")
    require("taskInput" not in show, "通知本文へタスク本文を含めないでください")
    require("ONEで完了した集中を記録してください。" in show, "通知本文は固定文言にしてください")

    key_builder = section(source, "function buildCompletionEffectKey", "function createCompletionEffectClaimToken")
    require("completionEndAt" in key_builder and "minutes" in key_builder, "同じタイマーをタブ間で識別できる完了IDを作ってください")
    require("Number.isSafeInteger(endAtValue)" in key_builder, "完了時刻は安全な整数として検証してください")
    require("minutes > MAX_MINUTES" in key_builder, "完了IDのタイマー時間も通常上限で検証してください")

    token_builder = section(source, "function createCompletionEffectClaimToken", "function isCompletionEffectClaimToken")
    require("crypto.getRandomValues" in token_builder, "利用可能ならWeb Cryptoでclaimトークンを生成してください")
    require("completionEffectFallbackCounter" in token_builder, "Web Crypto不可でも非秘密の一意性トークンへフォールバックしてください")

    claim_parser = section(source, "function parseCompletionEffectClaim", "let completionSoundEnabled")
    for token in (
        "raw.length > MAX_COMPLETION_EFFECT_CLAIM_BYTES",
        "JSON.parse(raw)",
        "Object.keys(value).length !== 4",
        "Object.hasOwn(value, 'key')",
        "Object.hasOwn(value, 'soundClaim')",
        "Object.hasOwn(value, 'notificationClaim')",
        "Object.hasOwn(value, 'updatedAt')",
        "isCompletionEffectClaimToken(value.soundClaim)",
        "isCompletionEffectClaimToken(value.notificationClaim)",
        "Number.isSafeInteger(value.updatedAt)",
    ):
        require(token in claim_parser, f"完了副作用claimの厳格検証に {token} が必要です")

    storage_claim = section(source, "async function claimCompletionEffectWithStorage", "async function claimCompletionEffect(")
    require("claimField" in storage_claim, "soundとnotificationのclaimを別フィールドで管理してください")
    require("safeRead(COMPLETION_EFFECT_CLAIM_STORAGE_KEY)" in storage_claim, "claim前に既存状態を読み込んでください")
    require("previousClaim?.key === completionKey && previousClaim[claimField] !== null" in storage_claim, "同じ完了・同じ副作用は再実行しないでください")
    require("createCompletionEffectClaimToken()" in storage_claim, "各claimへ所有トークンを発行してください")
    require("safeWrite(COMPLETION_EFFECT_CLAIM_STORAGE_KEY, payload)" in storage_claim, "claimを端末へ保存してください")
    require("COMPLETION_EFFECT_FALLBACK_SETTLE_MS" in storage_claim, "Web Locks非対応時は競合が落ち着く時間を置いて再確認してください")
    require("persisted[claimField] === claimToken" in storage_claim, "自分のclaimトークンが残ったタブだけ副作用を実行してください")
    require("if (storageAccessFailed) return true;" in storage_claim, "保存不能でも完了音・通知そのものは止めないでください")

    payload = section(source, "function completionEffectClaimPayload", "async function claimCompletionEffectWithStorage")
    require("soundClaim" in payload and "notificationClaim" in payload, "完了音と通知のclaim所有者を独立して保持してください")
    require("next[claimField] = claimToken;" in payload, "対象副作用だけ自分のclaimトークンへ更新してください")

    claim = section(source, "async function claimCompletionEffect(", "async function runCompletionEffectsOnce")
    require("navigator.locks" in claim and "navigator.locks.request" in claim, "利用可能なブラウザではWeb Locksでclaimを直列化してください")
    require("COMPLETION_EFFECT_LOCK_NAME" in claim, "完了副作用専用のWeb Lock名を使ってください")
    require("settle: true" in claim, "Web Locks非対応時は保存ベースのbest-effort fallbackを使ってください")

    effects = section(source, "async function runCompletionEffectsOnce", "async function toggleCompletionSound")
    require("claimCompletionEffect(completionKey, 'sound')" in effects, "完了音は完了単位で一度だけclaimしてください")
    require("claimCompletionEffect(completionKey, 'notification')" in effects, "デスクトップ通知も完了単位で一度だけclaimしてください")
    require("canShowCompletionNotification()" in effects, "背景通知の対象タブだけ通知claimへ参加してください")
    require("void playCompletionSound();" in effects, "完了音claim取得後だけ完了音を鳴らしてください")
    require("showCompletionNotification();" in effects, "通知claim取得後だけOS通知を表示してください")

    finish = section(source, "const finishTimerWithoutCompletionSound", "completionSoundToggle.addEventListener")
    key_position = finish.find("buildCompletionEffectKey(endAt, selectedMinutes)")
    base_position = finish.find("finishTimerWithoutCompletionSound();")
    effects_position = finish.find("runCompletionEffectsOnce(completionKey)")
    require(min(key_position, base_position, effects_position) >= 0, "完了ID生成・本来の完了処理・副作用実行を維持してください")
    require(key_position < base_position < effects_position, "endAtを消す前に完了IDを確定し、本来の完了処理後に副作用を実行してください")

    toggle_listener = section(source, "completionNotificationToggle.addEventListener('click'", "document.addEventListener('pointerdown'")
    require("enableCompletionNotification()" in toggle_listener, "通知権限要求は完了通知トグルから開始してください")

    storage_handler = source.split("window.addEventListener('storage'", 2)[-1]
    require("event.key !== COMPLETION_NOTIFICATION_STORAGE_KEY" in storage_handler, "別タブ同期は完了通知キーだけを対象にしてください")
    require("parseCompletionNotificationPreference(event.newValue)" in storage_handler, "別タブのnewValueを検証してください")
    require("Notification.requestPermission" not in storage_handler, "別タブ同期で通知権限を要求しないでください")
    require("safeWrite(" not in storage_handler, "別タブ同期で保存値を書き戻さないでください")

    visibility = section(source, "document.addEventListener('visibilitychange'", "window.addEventListener('pageshow'")
    require("document.visibilityState !== 'visible'" in visibility, "背景へ移るだけでは完了通知を閉じないでください")
    require("refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true })" in visibility, "タブへ戻った瞬間に通知と権限状態を整理してください")

    pageshow = source.split("window.addEventListener('pageshow'", 1)[-1]
    require("refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true })" in pageshow, "BFCacheなどから復元された場合も通知と権限状態を整理してください")
    require("Notification.requestPermission" not in visibility, "タブ復帰だけで通知権限を要求しないでください")
    require("Notification.requestPermission" not in pageshow, "ページ復元だけで通知権限を要求しないでください")

    require("'one.completionNotification.v1'" in privacy_reset, "完了通知設定を端末データ削除対象へ含めてください")
    require("'one.completionEffectClaim.v1'" in privacy_reset, "完了副作用claimも端末データ削除対象へ含めてください")

    print("Completion notification remains private and completion side effects are deduplicated across tabs.")


if __name__ == "__main__":
    main()
