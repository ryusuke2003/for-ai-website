from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOUND_PATH = ROOT / "completion-sound.js"


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f"ERROR: {start_marker} が見つかりません")
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"ERROR: {end_marker} が見つかりません")
    return source[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    source = SOUND_PATH.read_text(encoding="utf-8")

    persistence = section(
        source,
        "function persistCompletionSoundPreference(enabled)",
        "function getCompletionAudioContext()",
    )
    write_pos = persistence.find("safeWrite(COMPLETION_SOUND_STORAGE_KEY, value)")
    read_pos = persistence.find("safeRead(COMPLETION_SOUND_STORAGE_KEY) === value")
    failure_pos = persistence.find("reportStorageFailure()")
    require(write_pos >= 0, "完了音設定は共通safeWrite()で保存してください")
    require(read_pos >= 0, "完了音設定は保存後に読み戻して確認してください")
    require(failure_pos >= 0, "保存値が一致しない場合は端末保存障害として通知してください")
    require(write_pos < read_pos < failure_pos, "完了音設定は書き込み→読み戻し→障害通知の順で処理してください")
    require("localStorage." not in persistence, "完了音設定の保存処理でlocalStorageを直接操作しないでください")

    toggle = section(source, "async function toggleCompletionSound()", "function primeCompletionAudioFromGesture()")
    require("persistCompletionSoundPreference(false)" in toggle, "完了音OFF時も保存結果を確認してください")
    require("persistCompletionSoundPreference(true)" in toggle, "完了音ON時も保存結果を確認してください")
    require("再読み込みすると以前の設定へ戻る可能性があります" in toggle, "保存失敗時は再読み込み後に戻る可能性を明示してください")
    require("今のタブでは鳴ります" in toggle, "ONの保存失敗時は現在タブでは有効なことを明示してください")

    player = section(source, "async function playCompletionSound", "async function toggleCompletionSound()")
    require("previewMessage" in player, "試聴成功時に保存結果を反映したメッセージを表示できるようにしてください")
    require("ブラウザの音声再生制限" in player, "音声再生失敗の案内を保存失敗メッセージより優先してください")

    print("Completion sound persistence reports write/readback failures without disabling in-tab playback.")


if __name__ == "__main__":
    main()
