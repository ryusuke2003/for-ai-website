from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
MAIN_SOURCE = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
HERO_SOURCE = (ROOT / "src/components/HeroIntro.jsx").read_text(encoding="utf-8")
FOOTER_SOURCE = (ROOT / "src/components/AppFooter.jsx").read_text(encoding="utf-8")
THEME_SOURCE = (ROOT / "src/components/ThemeSwitcher.jsx").read_text(encoding="utf-8")
TIMER_CONTROLS_SOURCE = (ROOT / "src/components/TimerControls.jsx").read_text(encoding="utf-8")
THEME_COMPAT_SOURCE = (ROOT / "theme.js").read_text(encoding="utf-8")
TIMER_BRIDGE_SOURCE = (ROOT / "react-timer-controls-bridge.js").read_text(encoding="utf-8")
VITE_SOURCE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require('id="react-theme-root"' in INDEX_SOURCE, "テーマ切替用React境界がありません")
    require('id="react-hero-root"' in INDEX_SOURCE, "ヘッダー用React境界がありません")
    require('id="react-timer-controls-root"' in INDEX_SOURCE, "タイマー主操作用React境界がありません")
    require('id="react-footer-root"' in INDEX_SOURCE, "フッター用React境界がありません")
    require('id="react-root"' not in INDEX_SOURCE, "旧Reactプレースホルダーを残さないでください")

    require("createRoot" in MAIN_SOURCE, "手書きフォールバックをReactへ切り替える境界にはcreateRootを使ってください")
    require("<ThemeSwitcher />" in MAIN_SOURCE, "ThemeSwitcherをReactからマウントしてください")
    require("<HeroIntro />" in MAIN_SOURCE, "HeroIntroをReactからマウントしてください")
    require("<TimerControls />" in MAIN_SOURCE, "TimerControlsをReactからマウントしてください")
    require("<AppFooter />" in MAIN_SOURCE, "AppFooterをReactからマウントしてください")
    require("Built with React + Vite" not in MAIN_SOURCE, "導入確認用の仮表示を残さないでください")

    require("ONE SPRINT AT A TIME" in HERO_SOURCE, "ヘッダーのeyebrow文言を維持してください")
    require("まずは25分。" in HERO_SOURCE, "ヘッダー見出しを維持してください")
    require("データ収集なし · アカウントなし · 外部通信なし" in FOOTER_SOURCE, "フッター文言を維持してください")

    for token in (
        "one.theme.v1",
        "useState",
        "useEffect",
        "localStorage.setItem(THEME_STORAGE_KEY, theme)",
        "localStorage.getItem(THEME_STORAGE_KEY)",
        "window.addEventListener('storage', handleStorage)",
        "document.addEventListener('visibilitychange', refreshThemeWhenVisible)",
        "window.addEventListener('pageshow', refreshThemePreferenceFromStorage)",
        "globalThis.reportStorageFailure",
        'role="group"',
        'aria-describedby="theme-status"',
    ):
        require(token in THEME_SOURCE, f"ThemeSwitcherの移行要件がありません: {token}")

    for token in (
        "useState",
        "useEffect",
        "ONE_REACT_TIMER_CONTROLS",
        "one:timer-controls-state",
        "one:timer-controls-focus",
        'id="start-button"',
        'id="reset-button"',
        'id="focus-mode-button"',
        'aria-keyshortcuts="Space"',
        'aria-keyshortcuts="F Escape"',
    ):
        require(token in TIMER_CONTROLS_SOURCE, f"TimerControlsの移行要件がありません: {token}")

    for token in (
        "document.documentElement.dataset.reactTimerControls === '1'",
        "startButton.click()",
        "resetButton.click()",
        "focusModeButton.click()",
        "MutationObserver",
        "button.isConnected",
        "one:timer-controls-state",
        "one:timer-controls-focus",
    ):
        require(token in TIMER_BRIDGE_SOURCE, f"タイマー操作ブリッジの要件がありません: {token}")

    require(
        "document.documentElement.dataset.reactTheme !== '1'" in THEME_COMPAT_SOURCE,
        "旧theme.jsはVite/Reactテーマ管理が無効な場合だけ動く互換処理にしてください",
    )
    require(
        "order: 'pre'" in VITE_SOURCE,
        "ReactエントリはViteのHTML依存解析より前に注入してください",
    )
    require(
        "data-react-theme=\"1\"" in VITE_SOURCE,
        "Vite経由では旧theme.jsを停止するReactテーマ管理マーカーを付けてください",
    )
    require(
        "data-react-timer-controls=\"1\"" in VITE_SOURCE,
        "Vite経由ではReact版タイマー主操作を有効にするマーカーを付けてください",
    )
    require(
        "react-timer-controls-bridge.js" in VITE_SOURCE,
        "Vite経由ではvanillaタイマーとReact主操作を橋渡しするスクリプトを読み込んでください",
    )

    for source_name, source in (
        ("src/main.jsx", MAIN_SOURCE),
        ("src/components/HeroIntro.jsx", HERO_SOURCE),
        ("src/components/AppFooter.jsx", FOOTER_SOURCE),
        ("src/components/ThemeSwitcher.jsx", THEME_SOURCE),
        ("src/components/TimerControls.jsx", TIMER_CONTROLS_SOURCE),
    ):
        require("dangerouslySetInnerHTML" not in source, f"{source_name} でdangerouslySetInnerHTMLを使わないでください")

    print("React migration checks passed: presentation, theme, and primary timer controls are React-managed with guarded legacy fallbacks.")


if __name__ == "__main__":
    main()
