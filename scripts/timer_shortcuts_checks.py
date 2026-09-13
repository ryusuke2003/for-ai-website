from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
APP_SOURCE = (ROOT / "app.js").read_text(encoding="utf-8")
REACT_APP_SOURCE = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
HOOK_SOURCE = (ROOT / "src" / "features" / "timer" / "useTimerShortcuts.js").read_text(encoding="utf-8")
CONTROLS_SOURCE = (ROOT / "src" / "features" / "timer" / "TimerControls.jsx").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require('shortcuts.js' not in INDEX_SOURCE, "classic shortcuts.jsを読み込まないでください")
    require(not (ROOT / "shortcuts.js").exists(), "React移行後はshortcuts.jsを残さないでください")
    require("document.addEventListener('keydown'" not in APP_SOURCE,
            "キーボードショートカットをapp.jsへ戻さないでください")

    require("useTimerShortcuts" in REACT_APP_SOURCE, "TimerSectionからReactショートカットhookを利用してください")
    require("useTimerShortcuts(focusMode.active, focusMode.toggle);" in REACT_APP_SOURCE,
            "Escape/F判定へReact管理の集中表示状態と切替処理を渡してください")

    require("document.addEventListener('keydown', handleKeyDown);" in HOOK_SOURCE,
            "React hookでkeydownを購読してください")
    require("document.removeEventListener('keydown', handleKeyDown);" in HOOK_SOURCE,
            "unmount時にkeydown購読を解除してください")

    escape_pos = HOOK_SOURCE.find("event.key === 'Escape' && focusModeActive")
    guard_pos = HOOK_SOURCE.find("event.defaultPrevented")
    space_pos = HOOK_SOURCE.find("event.code === 'Space'")
    focus_pos = HOOK_SOURCE.find("event.key.toLowerCase() === 'f'")
    require(min(escape_pos, guard_pos, space_pos, focus_pos) >= 0,
            "Escape / Space / Fのショートカット処理を維持してください")
    require(escape_pos < guard_pos < space_pos < focus_pos,
            "Escapeは集中表示解除を優先し、Space/Fは入力保護後に処理してください")

    for token in (
        "event.isComposing || event.key === 'Process'",
        "event.repeat",
        "event.ctrlKey || event.metaKey || event.altKey || event.shiftKey",
        "isInteractiveShortcutTarget(event.target)",
    ):
        require(token in HOOK_SOURCE, f"誤操作防止条件がありません: {token}")

    require("import { timerActions } from './timerStore.js';" in HOOK_SOURCE,
            "SpaceショートカットはReactタイマーストアを利用してください")
    require("timerActions.toggle();" in HOOK_SOURCE,
            "SpaceはReactタイマーストアで開始/一時停止してください")
    require("ONE_REACT_TIMER_CONTROLS" not in HOOK_SOURCE,
            "削除したtimer interopをショートカットへ戻さないでください")
    require(HOOK_SOURCE.count("toggleFocusMode();") >= 2,
            "FとEscapeはReact管理の集中表示処理を直接切り替えてください")
    require("focusTimerControl('focus');" in HOOK_SOURCE,
            "Escape解除後は集中表示ボタンへフォーカスを戻してください")

    require('aria-keyshortcuts="Space"' in CONTROLS_SOURCE,
            "開始ボタンのaria-keyshortcutsを維持してください")
    require('aria-keyshortcuts="F Escape"' in CONTROLS_SOURCE,
            "集中表示ボタンのaria-keyshortcutsを維持してください")
    require("onClick={onToggleFocusMode}" in CONTROLS_SOURCE,
            "集中表示ボタンはReact側の切替処理を直接呼んでください")
    require("onClick={() => timerActions.toggle()}" in CONTROLS_SOURCE,
            "開始ボタンはReactタイマーストアを直接操作してください")

    print("Timer keyboard shortcuts and controls are React-store owned with input and focus safety.")


if __name__ == "__main__":
    main()
