from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HOOK_SOURCE = (ROOT / "src" / "features" / "timer" / "useFocusModeControl.js").read_text(encoding="utf-8")
APP_SOURCE = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
CONTROLS_SOURCE = (ROOT / "src" / "features" / "timer" / "TimerControls.jsx").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    end = source.find(end_marker, start + 1)
    if start < 0 or end < 0:
        fail(f"検査範囲を取得できません: {start_marker}")
    return source[start:end]


def main():
    require("FOCUS_MODE_STORAGE_KEY = 'one.focusMode.v1'" in HOOK_SOURCE,
            "集中表示の保存キー互換性を維持してください")

    persist = section(HOOK_SOURCE, "function persistFocusModePreference", "export function useFocusModeControl")
    write = persist.find("localStorage.setItem(FOCUS_MODE_STORAGE_KEY, value)")
    read = persist.find("localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === value")
    require(write >= 0 and read > write,
            "集中表示設定は書き込み後に読み戻して保存を確認してください")
    require("reportStorageFailure();" in persist,
            "保存例外や読み戻し不一致は端末保存障害として通知してください")

    hook = section(HOOK_SOURCE, "export function useFocusModeControl", "return {")
    require("setActive(nextActive);" in hook,
            "保存に失敗しても現在タブの集中表示切替は反映してください")
    require("const persisted = !persist || persistFocusModePreference(nextActive);" in hook,
            "集中表示切替時は永続化結果を確認してください")
    require("再読み込みすると通常表示に戻る可能性があります。" in hook,
            "集中表示ONの保存失敗を利用者へ明示してください")
    require("再読み込みすると集中表示へ戻る可能性があります。" in hook,
            "集中表示OFFの保存失敗を利用者へ明示してください")
    require("document.body.classList.toggle('focus-mode', active);" in HOOK_SOURCE,
            "bodyの集中表示classはReact状態から同期してください")
    require("if (completionReady && active)" in HOOK_SOURCE
            and "setFocusMode(false, { announce: false });" in HOOK_SOURCE,
            "タイマー完了時は集中表示を無言で解除してください")

    require("useFocusModeControl(timerState.completionReady)" in APP_SOURCE,
            "Appでタイマー完了状態と集中表示React hookを接続してください")
    require("focusModeActive={focusMode.active}" in APP_SOURCE,
            "集中表示ボタンへReact状態を渡してください")
    require("onToggleFocusMode={focusMode.toggle}" in APP_SOURCE,
            "集中表示ボタンへReact切替処理を渡してください")
    require("status={focusMode.status}" in APP_SOURCE,
            "集中表示の読み上げ状態もReactから表示してください")

    require("const focusLabel = focusModeActive ? '通常表示' : '集中表示';" in CONTROLS_SOURCE,
            "集中表示ボタンの文言はReact状態から決定してください")
    require("onClick={onToggleFocusMode}" in CONTROLS_SOURCE,
            "集中表示ボタンはReactの切替処理を直接利用してください")

    print("Focus mode controls and persistence are React-owned with verified writes and silent completion exit.")


if __name__ == "__main__":
    main()
