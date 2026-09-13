from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
MAIN_SOURCE = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
VITE_SOURCE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")
STATE_SOURCE = (ROOT / "react-timer-state-source.js").read_text(encoding="utf-8")
STATE_HOOK_SOURCE = (ROOT / "src/state/useTimerState.js").read_text(encoding="utf-8")
CONTROLS_SOURCE = (ROOT / "src/components/TimerControls.jsx").read_text(encoding="utf-8")
DISPLAY_SOURCE = (ROOT / "src/components/TimerDisplay.jsx").read_text(encoding="utf-8")
CONTROLS_BRIDGE_SOURCE = (ROOT / "react-timer-controls-bridge.js").read_text(encoding="utf-8")
THEME_SOURCE = (ROOT / "src/components/ThemeSwitcher.jsx").read_text(encoding="utf-8")
THEME_COMPAT_SOURCE = (ROOT / "theme.js").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    for root_id in (
        "react-theme-root",
        "react-hero-root",
        "react-timer-display-root",
        "react-timer-controls-root",
        "react-timer-settings-root",
        "react-footer-root",
    ):
        require(f'id="{root_id}"' in INDEX_SOURCE, f"React境界がありません: {root_id}")

    for component in (
        "ThemeSwitcher",
        "HeroIntro",
        "TimerDisplay",
        "TimerControls",
        "TimerSettings",
        "ProgressOverview",
        "ProgressDetails",
        "BackupPanel",
        "AppFooter",
    ):
        require(f"<{component} />" in MAIN_SOURCE, f"{component}をReactからマウントしてください")

    require("DOMContentLoaded" in MAIN_SOURCE and "{ once: true }" in MAIN_SOURCE, "legacy初期化後にReactを1回だけマウントしてください")
    require("useTimerState" in CONTROLS_SOURCE, "TimerControlsは共有タイマー状態を購読してください")
    require("useTimerState" in DISPLAY_SOURCE, "TimerDisplayは共有タイマー状態を購読してください")

    for token in ("ONE_REACT_TIMER_STATE", "one:timer-state", "queueMicrotask"):
        require(token in STATE_SOURCE, f"共有タイマー状態ソースの要件がありません: {token}")
    require("MutationObserver" not in STATE_SOURCE, "共有タイマー状態ソースでDOM監視を使わないでください")
    for token in ("useSyncExternalStore", "ONE_REACT_TIMER_STATE", "one:timer-state"):
        require(token in STATE_HOOK_SOURCE, f"共有タイマー状態フックの要件がありません: {token}")

    for token in ("startButton.click()", "resetButton.click()", "focusModeButton.click()", "one:timer-controls-focus"):
        require(token in CONTROLS_BRIDGE_SOURCE, f"既存の安全な操作経路を維持してください: {token}")
    require("MutationObserver" not in CONTROLS_BRIDGE_SOURCE, "タイマー操作ブリッジは操作とフォーカス転送だけにしてください")
    require("snapshot" not in CONTROLS_BRIDGE_SOURCE, "タイマー操作ブリッジへ状態管理を戻さないでください")

    require("one.theme.v1" in THEME_SOURCE, "ThemeSwitcherの保存形式を維持してください")
    require("document.documentElement.dataset.reactTheme !== '1'" in THEME_COMPAT_SOURCE, "旧theme.jsはReactテーマ管理が無効な場合だけ動かしてください")

    require("order: 'pre'" in VITE_SOURCE, "ReactエントリはViteのHTML依存解析より前に注入してください")
    for marker in (
        'data-react-theme=\"1\"',
        'data-react-timer-state=\"1\"',
        'data-react-timer-controls=\"1\"',
        'data-react-timer-settings=\"1\"',
        'data-react-progress-overview=\"1\"',
        'data-react-progress-details=\"1\"',
        'data-react-backup-panel=\"1\"',
    ):
        require(marker in VITE_SOURCE, f"ViteのReact有効化マーカーがありません: {marker}")
    require("react-timer-state-source.js" in VITE_SOURCE, "共有タイマー状態ソースをViteで読み込んでください")
    require("react-timer-display-bridge.js" not in VITE_SOURCE, "旧タイマー表示ブリッジをViteへ残さないでください")

    for path in (
        "src/main.jsx",
        "src/components/ThemeSwitcher.jsx",
        "src/components/TimerControls.jsx",
        "src/components/TimerDisplay.jsx",
        "src/components/TimerSettings.jsx",
        "src/components/ProgressOverview.jsx",
        "src/components/ProgressDetails.jsx",
        "src/components/BackupPanel.jsx",
    ):
        source = (ROOT / path).read_text(encoding="utf-8")
        require("dangerouslySetInnerHTML" not in source, f"{path}でdangerouslySetInnerHTMLを使わないでください")

    print("React migration checks passed: timer display and controls share one event-driven state source while remaining domains keep guarded boundaries.")


if __name__ == "__main__":
    main()
