from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "completion-sound.js").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    handler = SOURCE.split("window.addEventListener('storage'", 2)[-1]

    require(
        "event.key !== COMPLETION_NOTIFICATION_STORAGE_KEY" in handler,
        "完了通知の別タブ同期は専用保存キーだけを対象にしてください",
    )
    require(
        "parseCompletionNotificationPreference(event.newValue)" in handler,
        "完了通知の別タブ同期値を検証してください",
    )

    support_pos = handler.find("completionNotificationSupported && Notification.permission === 'granted'")
    apply_pos = handler.find("completionNotificationEnabled = nextEnabled && permissionGranted;")
    require(support_pos >= 0, "Notification API対応確認後だけpermissionを参照してください")
    require(apply_pos > support_pos, "対応・権限確認後だけ別タブのON設定を反映してください")

    require(
        "Notification.requestPermission" not in handler,
        "別タブ同期から通知権限を要求しないでください",
    )
    require("safeWrite(" not in handler, "別タブ同期で保存値を書き戻さないでください")
    require(
        "別のタブで完了通知がオンになりましたが、このブラウザでは完了通知を利用できません。" in handler,
        "非対応ブラウザではOFFへ変更されたと誤案内しないでください",
    )
    require(
        "別のタブで完了通知がオンになりましたが、このタブでは通知が許可されていません。" in handler,
        "通知権限未許可時はOFFへ変更されたと誤案内しないでください",
    )

    print("Completion notification cross-tab sync is guarded for unsupported and unpermitted browsers.")


if __name__ == "__main__":
    main()
