from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STATE_SOURCE = (ROOT / "react-timer-state-source.js").read_text(encoding="utf-8")
HOOK_SOURCE = (ROOT / "src/state/useTimerState.js").read_text(encoding="utf-8")
CONTROLS_SOURCE = (ROOT / "src/components/TimerControls.jsx").read_text(encoding="utf-8")
DISPLAY_SOURCE = (ROOT / "src/components/TimerDisplay.jsx").read_text(encoding="utf-8")
CONTROLS_BRIDGE_SOURCE = (ROOT / "react-timer-controls-bridge.js").read_text(encoding="utf-8")
VITE_SOURCE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")
OLD_DISPLAY_BRIDGE = ROOT / "react-timer-display-bridge.js"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    for token in (
        "ONE_REACT_TIMER_STATE",
        "one:timer-state",
        "selectedMinutes",
        "remainingSeconds",
        "completionReady",
        "queueMicrotask",
        "setTimerFeedback",
        "setRecordAvailability",
        "renderTimer",
        "setStartButton",
        "setFocusMode",
    ):
        require(token in STATE_SOURCE, f"React向けタイマー状態ソースの要件がありません: {token}")
    require("MutationObserver" not in STATE_SOURCE, "タイマー状態同期をDOM監視へ戻さないでください")

    for token in (
        "useSyncExternalStore",
        "ONE_REACT_TIMER_STATE",
        "one:timer-state",
    ):
        require(token in HOOK_SOURCE, f"共有タイマー状態フックの要件がありません: {token}")

    require("useTimerState" in CONTROLS_SOURCE, "TimerControlsは共有タイマー状態を購読してください")
    require("useTimerState" in DISPLAY_SOURCE, "TimerDisplayは共有タイマー状態を購読してください")
    require("one:timer-controls-state" not in CONTROLS_SOURCE, "TimerControlsの旧専用状態イベントを残さないでください")
    require("ONE_REACT_TIMER_DISPLAY" not in DISPLAY_SOURCE, "TimerDisplayの旧表示ブリッジ参照を残さないでください")
    require("one:timer-display-state" not in DISPLAY_SOURCE, "TimerDisplayの旧表示イベントを残さないでください")

    require("MutationObserver" not in CONTROLS_BRIDGE_SOURCE, "タイマー操作ブリッジはDOM状態監視を担当しないでください")
    require("snapshot" not in CONTROLS_BRIDGE_SOURCE, "タイマー操作ブリッジは状態スナップショットを持たないでください")
    for token in ("startButton.click()", "resetButton.click()", "focusModeButton.click()"):
        require(token in CONTROLS_BRIDGE_SOURCE, f"既存の安全な操作経路を維持してください: {token}")

    require(not OLD_DISPLAY_BRIDGE.exists(), "旧react-timer-display-bridge.jsは削除してください")
    require('data-react-timer-state=\"1\"' in VITE_SOURCE, "Viteで共有タイマー状態ソースを有効にしてください")
    require("react-timer-state-source.js" in VITE_SOURCE, "Viteで共有タイマー状態ソースを読み込んでください")
    require("react-timer-display-bridge.js" not in VITE_SOURCE, "旧タイマー表示ブリッジをViteへ残さないでください")

    print("React timer state checks passed: display and controls share one event-driven timer state source without DOM observers.")


if __name__ == "__main__":
    main()
