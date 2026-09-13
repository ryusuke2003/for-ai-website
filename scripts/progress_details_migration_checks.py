from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MAIN_SOURCE = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
COMPONENT_SOURCE = (ROOT / "src/components/ProgressDetails.jsx").read_text(encoding="utf-8")
HOOK_SOURCE = (ROOT / "src/state/useProgressDetailsState.js").read_text(encoding="utf-8")
STATE_SOURCE = (ROOT / "react-remaining-state-source.js").read_text(encoding="utf-8")
BRIDGE_SOURCE = (ROOT / "react-progress-details-bridge.js").read_text(encoding="utf-8")
VITE_SOURCE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require("<ProgressDetails />" in MAIN_SOURCE, "ProgressDetailsをReactからマウントしてください")
    require("ensureProgressDetailsRoot" in MAIN_SOURCE, "目標・可視化用のReact境界を既存DOM初期化後に生成してください")

    for token in (
        "useProgressDetailsState",
        "ONE_REACT_PROGRESS_DETAILS",
        'id="daily-goal-input"',
        'id="daily-goal-apply"',
        'id="daily-goal-clear"',
        'className="daily-goal-progress"',
        'id="history-grid"',
        'id="activity-grid"',
        'id="activity-summary"',
    ):
        require(token in COMPONENT_SOURCE, f"ProgressDetailsの移行要件がありません: {token}")

    for token in (
        "useSyncExternalStore",
        "ONE_REACT_PROGRESS_DETAILS_STATE",
        "one:progress-details-state",
    ):
        require(token in HOOK_SOURCE, f"ProgressDetails状態フックの要件がありません: {token}")

    for token in (
        "buildProgressDetailsSnapshot",
        "ONE_REACT_PROGRESS_DETAILS_STATE",
        "ONE_REACT_REMAINING_STATE",
        "one:progress-details-state",
        "historyGrid.querySelectorAll",
        "activityGrid.children",
        "queueMicrotask",
    ):
        require(token in STATE_SOURCE, f"目標・可視化共有状態の要件がありません: {token}")
    require("MutationObserver" not in STATE_SOURCE, "目標・可視化共有状態でDOM監視を使わないでください")

    for token in (
        "ONE_REACT_PROGRESS_DETAILS",
        "dailyGoalInput.dispatchEvent",
        "dailyGoalApplyButton.click()",
        "dailyGoalClearButton.click()",
        "refreshProgressDetails",
    ):
        require(token in BRIDGE_SOURCE, f"目標・可視化操作ブリッジの要件がありません: {token}")
    require("MutationObserver" not in BRIDGE_SOURCE, "目標・可視化ブリッジは操作専用にしてください")
    require("snapshot" not in BRIDGE_SOURCE, "目標・可視化ブリッジへ状態管理を戻さないでください")

    require('data-react-progress-details=\"1\"' in VITE_SOURCE, "ViteでReact版目標・可視化UIを有効にしてください")
    require("react-remaining-state-source.js" in VITE_SOURCE, "Viteで残りのReact共有状態を読み込んでください")
    require("react-progress-details-bridge.js" in VITE_SOURCE, "Viteで目標・可視化操作ブリッジを読み込んでください")

    print("Progress details migration checks passed: React subscribes to an event-driven external store without MutationObserver.")


if __name__ == "__main__":
    main()
