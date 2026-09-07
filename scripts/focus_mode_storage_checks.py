from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def section(start_marker, end_marker):
    start = SOURCE.find(start_marker)
    end = SOURCE.find(end_marker, start + 1)
    if start < 0 or end < 0:
        fail(f"検査範囲を取得できません: {start_marker}")
    return SOURCE[start:end]


def main():
    persist = section("function persistFocusModePreference", "function setFocusMode")
    write = persist.find("safeWrite(STORAGE_KEYS.focusMode, value)")
    read = persist.find("safeRead(STORAGE_KEYS.focusMode)")
    failure_check = persist.find("if (storageAccessFailed) return false;", read)
    mismatch_report = persist.find("reportStorageFailure();", read)

    require(min(write, read, failure_check, mismatch_report) >= 0, "集中表示設定の保存確認処理が見つかりません")
    require(write < read < failure_check < mismatch_report, "集中表示設定は書き込み後に読み戻し、不一致を保存障害として通知してください")
    require("if (stored === value) return true;" in persist, "保存値が一致した場合だけ永続化成功としてください")

    focus = section("function setFocusMode", "function revealCompletionRecord")
    require(
        "const persisted = !persist || persistFocusModePreference(active);" in focus,
        "集中表示の切替時は永続化結果を確認してください",
    )
    require(
        "再読み込みすると通常表示に戻る可能性があります。" in focus,
        "集中表示ONの保存失敗を利用者へ明示してください",
    )
    require(
        "再読み込みすると集中表示へ戻る可能性があります。" in focus,
        "集中表示OFFの保存失敗を利用者へ明示してください",
    )
    require(
        "if (persist) safeWrite(STORAGE_KEYS.focusMode" not in focus,
        "集中表示設定を読み戻し確認なしで保存しないでください",
    )

    reveal = section("function revealCompletionRecord", "function stopTimer")
    require(
        "setFocusMode(false, { announce: false });" in reveal,
        "タイマー完了時の集中表示解除は引き続き無言で行ってください",
    )

    load_state = section("function loadState", "taskInput.addEventListener")
    require(
        "setFocusMode(safeRead(STORAGE_KEYS.focusMode) === '1', { persist: false, announce: false });" in load_state,
        "初期読込では集中表示設定を書き戻したり読み上げたりしないでください",
    )

    print("Focus mode keeps current-tab behavior while verifying persistence and reporting save failures.")


if __name__ == "__main__":
    main()
