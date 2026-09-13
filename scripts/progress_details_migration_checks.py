from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MAIN_SOURCE = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
COMPONENT_SOURCE = (ROOT / "src/components/ProgressDetails.jsx").read_text(encoding="utf-8")
BRIDGE_SOURCE = (ROOT / "react-progress-details-bridge.js").read_text(encoding="utf-8")
VITE_SOURCE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require("<ProgressDetails />" in MAIN_SOURCE, "ProgressDetailsをReactからマウントしてください")
    require("ensureProgressDetailsRoot" in MAIN_SOURCE, "目標・可視化用のReact境界を既存DOM初期化後に生成してください")

    for token in (
        "ONE_REACT_PROGRESS_DETAILS",
        "one:progress-details-state",
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
        "reactProgressDetails",
        "ONE_REACT_PROGRESS_DETAILS",
        "progressDetailsSnapshot",
        "one:progress-details-state",
        "dailyGoalInput.dispatchEvent",
        "dailyGoalApplyButton.click()",
        "dailyGoalClearButton.click()",
        "historyGrid.querySelectorAll",
        "activityGrid.children",
        "MutationObserver",
    ):
        require(token in BRIDGE_SOURCE, f"目標・可視化ブリッジの要件がありません: {token}")

    require('data-react-progress-details=\"1\"' in VITE_SOURCE, "ViteでReact版目標・可視化UIを有効にしてください")
    require("react-progress-details-bridge.js" in VITE_SOURCE, "Viteで目標・可視化ブリッジを読み込んでください")

    print("Progress details migration checks passed.")


if __name__ == "__main__":
    main()
