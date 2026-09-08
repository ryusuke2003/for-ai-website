from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOUND_PATH = ROOT / "completion-sound.js"


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f"ERROR: {start_marker} が見つかりません")
    end = source.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f"ERROR: {end_marker} が見つかりません")
    return source[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    source = SOUND_PATH.read_text(encoding="utf-8")

    parser = section(
        source,
        "function parseCompletionSoundPreference(value)",
        "let completionSoundEnabled",
    )
    require("value === '1'" in parser, "完了音の保存値1をONとして扱ってください")
    require("value === '0' || value === null" in parser, "完了音の保存値0と削除をOFFとして扱ってください")
    require("return null;" in parser, "未知の完了音保存値を無効値として拒否してください")
    require(
        "parseCompletionSoundPreference(safeRead(COMPLETION_SOUND_STORAGE_KEY)) === true" in source,
        "初期状態も共通の完了音保存値パーサを使ってください",
    )

    persistence = section(
        source,
        "function persistCompletionSoundPreference(enabled)",
        "function refreshCompletionSoundPreferenceFromStorage()",
    )
    write_pos = persistence.find("safeWrite(COMPLETION_SOUND_STORAGE_KEY, value)")
    read_pos = persistence.find("safeRead(COMPLETION_SOUND_STORAGE_KEY) === value")
    failure_pos = persistence.find("reportStorageFailure()")
    require(write_pos >= 0, "完了音設定は共通safeWrite()で保存してください")
    require(read_pos >= 0, "完了音設定は保存後に読み戻して確認してください")
    require(failure_pos >= 0, "保存値が一致しない場合は端末保存障害として通知してください")
    require(write_pos < read_pos < failure_pos, "完了音設定は書き込み→読み戻し→障害通知の順で処理してください")
    require("localStorage." not in persistence, "完了音設定の保存処理でlocalStorageを直接操作しないでください")

    resume = section(
        source,
        "function refreshCompletionSoundPreferenceFromStorage()",
        "function getCompletionAudioContext()",
    )
    first_guard = resume.find("if (storageAccessFailed) return false;")
    read_position = resume.find("safeRead(COMPLETION_SOUND_STORAGE_KEY)")
    second_guard = resume.find("if (storageAccessFailed) return false;", first_guard + 1)
    parse_position = resume.find("parseCompletionSoundPreference(storedPreference)")
    invalid_guard = resume.find("if (nextEnabled === null) return false;")
    unchanged_guard = resume.find("if (completionSoundEnabled === nextEnabled) return true;")
    apply_position = resume.find("completionSoundEnabled = nextEnabled;")
    sync_position = resume.find("syncCompletionSoundUi();")
    require(
        min(
            first_guard,
            read_position,
            second_guard,
            parse_position,
            invalid_guard,
            unchanged_guard,
            apply_position,
            sync_position,
        ) >= 0,
        "復帰時の完了音再同期に必要な処理が見つかりません",
    )
    require(
        first_guard < read_position < second_guard < parse_position < invalid_guard < unchanged_guard < apply_position < sync_position,
        "復帰時は保存障害確認→読込→障害再確認→検証→変更確認→反映→UI更新の順にしてください",
    )
    require("safeWrite(" not in resume, "復帰時の完了音再同期から保存値を書き戻さないでください")
    require("persistCompletionSoundPreference" not in resume, "復帰時の完了音再同期で永続化を再実行しないでください")
    require("playCompletionSound" not in resume, "復帰時の設定同期で試聴音を鳴らさないでください")
    require("unlockCompletionAudio" not in resume, "復帰するだけでAudioContextを起動しないでください")

    player = section(source, "async function playCompletionSound", "function closeActiveCompletionNotification")
    require("previewMessage" in player, "試聴成功時に保存結果を反映したメッセージを表示できるようにしてください")
    require("ブラウザの音声再生制限" in player, "音声再生失敗の案内を保存失敗メッセージより優先してください")

    completion_effects = section(
        source,
        "async function runCompletionEffectsOnce(completionKey)",
        "async function toggleCompletionSound()",
    )
    unlock_pos = completion_effects.find("const context = await unlockCompletionAudio();")
    claim_pos = completion_effects.find("claimCompletionEffect(completionKey, 'sound')")
    schedule_pos = completion_effects.find("scheduleCompletionChime(context)")
    require(min(unlock_pos, claim_pos, schedule_pos) >= 0, "完了音は準備・claim・再生の3段階を維持してください")
    require(unlock_pos < claim_pos < schedule_pos, "完了音はAudioContext準備後にclaimし、claim成功後だけ鳴らしてください")
    require("if (!context)" in completion_effects, "AudioContextを利用できないタブはsound claimへ進ませないでください")
    require("playCompletionSound()" not in completion_effects, "タイマー完了時はclaim後に再度AudioContext準備をやり直さないでください")
    require("ブラウザの音声再生制限" in completion_effects, "完了音を準備できない場合も利用者へ理由を示してください")

    toggle = section(source, "async function toggleCompletionSound()", "function primeCompletionAudioFromGesture()")
    require("persistCompletionSoundPreference(false)" in toggle, "完了音OFF時も保存結果を確認してください")
    require("persistCompletionSoundPreference(true)" in toggle, "完了音ON時も保存結果を確認してください")
    require("再読み込みすると以前の設定へ戻る可能性があります" in toggle, "保存失敗時は再読み込み後に戻る可能性を明示してください")
    require("今のタブでは鳴ります" in toggle, "ONの保存失敗時は現在タブでは有効なことを明示してください")

    storage_sync = section(
        source,
        "window.addEventListener('storage', (event) => {",
        "window.addEventListener('storage', (event) => {",
    )
    require("event.key !== COMPLETION_SOUND_STORAGE_KEY" in storage_sync, "完了音キーのstorageイベントだけを処理してください")
    require("parseCompletionSoundPreference(event.newValue)" in storage_sync, "別タブ同期はstorageイベントのnewValueを検証してください")
    require("if (nextEnabled === null) return;" in storage_sync, "未知の別タブ保存値は無視してください")
    require("completionSoundEnabled = nextEnabled;" in storage_sync, "検証済みの別タブ設定を現在タブへ反映してください")
    require("syncCompletionSoundUi(" in storage_sync, "別タブ同期後は完了音UIを更新してください")
    require("refreshCompletionSoundPreferenceFromStorage" not in storage_sync, "storageイベントではevent.newValueを直接使い、保存値を再読込しないでください")
    require("persistCompletionSoundPreference" not in storage_sync, "別タブ同期時に保存値を書き戻さないでください")
    require("playCompletionSound" not in storage_sync, "別タブでONになっても現在タブで勝手に試聴音を鳴らさないでください")
    require("別のタブで完了音がオン" in storage_sync, "別タブからONへ変わったことを利用者へ通知してください")
    require("別のタブで完了音がオフ" in storage_sync, "別タブからOFFへ変わったことを利用者へ通知してください")

    visible_sync = section(
        source,
        "document.addEventListener('visibilitychange', () => {",
        "window.addEventListener('pageshow', () => {",
    )
    visible_guard = visible_sync.find("document.visibilityState !== 'visible'")
    sound_refresh = visible_sync.find("refreshCompletionSoundPreferenceFromStorage();")
    notification_refresh = visible_sync.find("refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true });")
    require(min(visible_guard, sound_refresh, notification_refresh) >= 0, "前面復帰時の完了音・通知同期を確認できません")
    require(visible_guard < sound_refresh < notification_refresh, "前面復帰時は可視性確認後に完了音、完了通知の順で再同期してください")

    pageshow_sync = section(
        source,
        "window.addEventListener('pageshow', () => {",
        "syncCompletionSoundUi();",
    )
    pageshow_sound = pageshow_sync.find("refreshCompletionSoundPreferenceFromStorage();")
    pageshow_notification = pageshow_sync.find("refreshCompletionNotificationFromBrowser({ closeVisibleNotification: true });")
    require(min(pageshow_sound, pageshow_notification) >= 0, "BFCache復帰時の完了音・通知同期を確認できません")
    require(pageshow_sound < pageshow_notification, "BFCache復帰時も完了音、完了通知の順で再同期してください")

    print("Completion sound persistence, readiness-before-claim, resume refresh, and cross-tab synchronization are guarded safely.")


if __name__ == "__main__":
    main()
