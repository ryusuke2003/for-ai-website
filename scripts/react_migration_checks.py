from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
MAIN_SOURCE = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
HERO_SOURCE = (ROOT / "src/components/HeroIntro.jsx").read_text(encoding="utf-8")
FOOTER_SOURCE = (ROOT / "src/components/AppFooter.jsx").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require('id="react-hero-root"' in INDEX_SOURCE, "ヘッダー用React境界がありません")
    require('id="react-footer-root"' in INDEX_SOURCE, "フッター用React境界がありません")
    require('id="react-root"' not in INDEX_SOURCE, "旧Reactプレースホルダーを残さないでください")

    require("hydrateRoot" in MAIN_SOURCE, "既存HTMLを維持した段階移行にはhydrateRootを使ってください")
    require("<HeroIntro />" in MAIN_SOURCE, "HeroIntroをReactからハイドレートしてください")
    require("<AppFooter />" in MAIN_SOURCE, "AppFooterをReactからハイドレートしてください")
    require("Built with React + Vite" not in MAIN_SOURCE, "導入確認用の仮表示を残さないでください")

    require("ONE SPRINT AT A TIME" in HERO_SOURCE, "ヘッダーのeyebrow文言を維持してください")
    require("まずは25分。" in HERO_SOURCE, "ヘッダー見出しを維持してください")
    require("データ収集なし · アカウントなし · 外部通信なし" in FOOTER_SOURCE, "フッター文言を維持してください")

    for source_name, source in (
        ("src/main.jsx", MAIN_SOURCE),
        ("src/components/HeroIntro.jsx", HERO_SOURCE),
        ("src/components/AppFooter.jsx", FOOTER_SOURCE),
    ):
        require("dangerouslySetInnerHTML" not in source, f"{source_name} でdangerouslySetInnerHTMLを使わないでください")

    print("React migration step checks passed: static fallbacks and hydrated components stay aligned.")


if __name__ == "__main__":
    main()
