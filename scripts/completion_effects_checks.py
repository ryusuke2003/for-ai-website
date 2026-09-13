from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HOOK_SOURCE = (ROOT / "src" / "features" / "timer" / "useCompletionEffectsControl.js").read_text(encoding="utf-8")
SETTINGS_SOURCE = (ROOT / "src" / "features" / "timer" / "TimerSettings.jsx").read_text(encoding="utf-8")
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
PRIVACY_RESET_SOURCE = (ROOT / "src" / "features" / "backup" / "usePrivacyResetControl.js").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    require(start >= 0, f"{start_marker} が見つかりません")
    end = source.find(end_marker, start + len(start_marker))
    require(end > start, f"{end_marker} が見つかりません")
    return source[start:end]


def main():
    require('completion-sound.js' not in INDEX_SOURCE, "classic completion-sound.js を読み込まないでください")
    require('id="completion-sound-toggle"' not in INDEX_SOURCE, "完了音のlegacy scaffold UIを残さないでください")
    require('id="completion-notification-toggle"' not in INDEX_SOURCE, "完了通知のlegacy scaffold UIを残さないでください")
    require('useCompletionEffectsControl(timerState)' in SETTINGS_SOURCE, "TimerSettingsからReact完了副作用hookを利用してください")
    require('id="completion-sound-toggle"' in SETTINGS_SOURCE, "React側に完了音トグルを維持してください")
    require('id="completion-notification-toggle"' in SETTINGS_SOURCE, "React側に完了通知トグルを維持してください")

    for token in (
        "COMPLETION_SOUND_STORAGE_KEY = 'one.completionSound.v1'",
        "COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1'",
        "COMPLETION_EFFECT_CLAIM_STORAGE_KEY = 'one.completionEffectClaim.v1'",
        "COMPLETION_EFFECT_LOCK_NAME = 'one-completion-effect-v1'",
    ):
        require(token in HOOK_SOURCE, f"互換性のため {token} を維持してください")

    require("if (value === '1') return true;" in HOOK_SOURCE, "保存値1だけをONとして扱ってください")
    require("if (value === '0' || value === null) return false;" in HOOK_SOURCE, "保存値0と削除はOFFとして扱ってください")
    require("localStorage.setItem(key, value)" in HOOK_SOURCE, "設定保存を書き込んでください")
    require("localStorage.getItem(key)" in HOOK_SOURCE, "設定保存は読み戻し確認してください")
    require("window.dispatchEvent(new Event('one:storage-error'))" in HOOK_SOURCE, "保存失敗を既存runtimeへ通知してください")

    key_builder = section(HOOK_SOURCE, "function buildCompletionEffectKey", "function createCompletionEffectClaimToken")
    require("completionEndAt" in key_builder and "minutes" in key_builder, "完了IDへ終了時刻と時間を含めてください")
    require("Number.isSafeInteger(endAtValue)" in key_builder, "完了時刻を安全な整数として検証してください")
    require("minutes > MAX_TIMER_MINUTES" in key_builder, "タイマー時間の上限を検証してください")

    claim_parser = section(HOOK_SOURCE, "function parseCompletionEffectClaim", "function completionEffectClaimPayload")
    for token in (
        "raw.length > MAX_COMPLETION_EFFECT_CLAIM_BYTES",
        "JSON.parse(raw)",
        "Object.keys(value).length !== 4",
        "Object.hasOwn(value, 'soundClaim')",
        "Object.hasOwn(value, 'notificationClaim')",
        "Number.isSafeInteger(value.updatedAt)",
    ):
        require(token in claim_parser, f"claim検証に {token} が必要です")

    claim = section(HOOK_SOURCE, "async function claimCompletionEffect(", "function soundDefaultStatus")
    require("navigator.locks.request" in claim, "利用可能な場合はWeb Locksで副作用claimを直列化してください")
    require("settle: true" in claim, "Web Locks非対応時はstorage fallbackを利用してください")

    effects = section(HOOK_SOURCE, "const runCompletionEffectsOnce", "useEffect(() => {")
    unlock_position = effects.find("const context = await unlockCompletionAudio();")
    sound_claim_position = effects.find("claimCompletionEffect(completionKey, 'sound')")
    sound_play_position = effects.find("scheduleCompletionChime(context)")
    require(min(unlock_position, sound_claim_position, sound_play_position) >= 0, "完了音の準備・claim・再生を維持してください")
    require(unlock_position < sound_claim_position < sound_play_position, "完了音は準備後にclaimし、その後だけ再生してください")
    require("claimCompletionEffect(completionKey, 'notification')" in effects, "完了通知も完了単位でclaimしてください")
    require("showCompletionNotification()" in effects, "claim取得後だけ完了通知を表示してください")

    require("Notification.requestPermission()" in HOOK_SOURCE, "明示的なON操作で通知権限を要求してください")
    require("document.visibilityState !== 'visible'" in HOOK_SOURCE, "前面タブではOS通知を表示しないでください")
    require("new Notification('集中スプリント完了'" in HOOK_SOURCE, "固定タイトルの完了通知を利用してください")
    require("ONEで完了した集中を記録してください。" in HOOK_SOURCE, "通知本文へタスク内容を含めないでください")

    transition = section(HOOK_SOURCE, "const previous = previousTimerStateRef.current;", "async function toggleSound")
    require("previous?.running === true" in transition, "実際に走っていたタイマーの完了だけを副作用対象にしてください")
    require("timerState.completionReady === true" in transition, "記録待ちの完了だけを副作用対象にしてください")
    require("timerState.remainingSeconds === 0" in transition, "0秒到達時だけ副作用を実行してください")
    require("buildCompletionEffectKey(previous.endAt, previous.selectedMinutes)" in transition, "停止処理でendAtが消える前の状態から完了IDを作ってください")

    storage_handler = section(HOOK_SOURCE, "function handleStorage(event)", "function primeAudioFromGesture")
    require("event.key === COMPLETION_SOUND_STORAGE_KEY" in storage_handler, "完了音の別タブ同期を維持してください")
    require("event.key !== COMPLETION_NOTIFICATION_STORAGE_KEY" in storage_handler, "完了通知の別タブ同期を専用キーに限定してください")
    require("parsePreference(event.newValue)" in storage_handler, "別タブ保存値を検証してください")
    require("Notification.requestPermission" not in storage_handler, "別タブ同期から通知権限を要求しないでください")
    require("writeStorage(" not in storage_handler and "persistPreference(" not in storage_handler, "別タブ同期で保存値を書き戻さないでください")

    for key in (
        "'one.completionSound.v1'",
        "'one.completionNotification.v1'",
        "'one.completionEffectClaim.v1'",
    ):
        require(key in PRIVACY_RESET_SOURCE, f"端末データ削除対象に {key} を含めてください")

    print("React completion effects preserve opt-in audio, private notification, and cross-tab deduplication.")


if __name__ == "__main__":
    main()
