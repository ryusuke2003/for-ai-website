from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
MAIN_SOURCE = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
HERO_SOURCE = (ROOT / "src/components/HeroIntro.jsx").read_text(encoding="utf-8")
FOOTER_SOURCE = (ROOT / "src/components/AppFooter.jsx").read_text(encoding="utf-8")
THEME_SOURCE = (ROOT / "src/components/ThemeSwitcher.jsx").read_text(encoding="utf-8")
THEME_COMPAT_SOURCE = (ROOT / "theme.js").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require('id="react-theme-root"' in INDEX_SOURCE, "テーマ切替用React境界がありません")
    require('id="react-hero-root"' in INDEX_SOURCE, "ヘッダー用React境界がありません")
    require('id="react-footer-root"' in INDEX_SOURCE, "フッター用React境界がありません")
    require('id="react-root"' not in INDEX_SOURCE, "旧Reactプレースホルダーを残さないでください")

    require("createRoot" in MAIN_SOURCE, "手書きフォールバックをReactへ切り替える境界にはcreateRootを使ってください")
    require("<ThemeSwitcher />" in MAIN_SOURCE, "ThemeSwitcherをReactからマウントしてください")
    require("<HeroIntro />" in MAIN_SOURCE, "HeroIntroをReactからマウントしてください")
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

    require(
        "if (!document.querySelector('#react-theme-root'))" in THEME_COMPAT_SOURCE,
        "旧theme.jsはReactテーマUIがない場合だけ動く互換処理にしてください",
    )

    for source_name, source in (
        ("src/main.jsx", MAIN_SOURCE),
        ("src/components/HeroIntro.jsx", HERO_SOURCE),
        ("src/components/AppFooter.jsx", FOOTER_SOURCE),
        ("src/components/ThemeSwitcher.jsx", THEME_SOURCE),
    ):
        require("dangerouslySetInnerHTML" not in source, f"{source_name} でdangerouslySetInnerHTMLを使わないでください")

    print("React migration checks passed: presentation and theme UI are React-managed with a guarded legacy fallback.")


if __name__ == "__main__":
    main()
