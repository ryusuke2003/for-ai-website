import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
VITE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")
MAIN = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
TAILWIND = (ROOT / "src/tailwind.css").read_text(encoding="utf-8")
HERO = (ROOT / "src/components/HeroIntro.jsx").read_text(encoding="utf-8")
THEME = (ROOT / "src/components/ThemeSwitcher.jsx").read_text(encoding="utf-8")
FOOTER = (ROOT / "src/components/AppFooter.jsx").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    dev_dependencies = PACKAGE.get("devDependencies", {})
    require(dev_dependencies.get("tailwindcss") == "4.3.3", "Tailwind CSS 4.3.3を固定してください")
    require(dev_dependencies.get("@tailwindcss/vite") == "4.3.3", "Tailwind Vite plugin 4.3.3を固定してください")

    require("import tailwindcss from '@tailwindcss/vite';" in VITE, "ViteでTailwind pluginを読み込んでください")
    require("tailwindcss()" in VITE, "Vite pluginsにTailwindを登録してください")
    require("import './tailwind.css';" in MAIN, "ReactエントリからTailwind CSSを読み込んでください")

    require('tailwindcss/theme.css' in TAILWIND, "Tailwind theme layerを読み込んでください")
    require('tailwindcss/utilities.css' in TAILWIND, "Tailwind utilities layerを読み込んでください")
    require('tailwindcss/preflight.css' not in TAILWIND, "段階移行中はPreflightを有効化しないでください")
    require('@import "tailwindcss";' not in TAILWIND, "段階移行中はPreflightを含む一括importを使わないでください")

    for token in (
        "text-[clamp(2.8rem,10vw,6.6rem)]",
        "tracking-[-0.06em]",
        "max-w-[560px]",
    ):
        require(token in HERO, f"HeroのTailwind移行要件がありません: {token}")

    for token in (
        "flex items-center justify-end",
        "max-[560px]:justify-start",
        "rounded-full border-0 bg-transparent",
    ):
        require(token in THEME, f"ThemeSwitcherのTailwind移行要件がありません: {token}")

    require("px-1 pb-0 pt-7 text-center text-[0.8rem]" in FOOTER, "FooterをTailwind utilityで表現してください")

    require((ROOT / "styles.css").exists(), "段階移行中はlegacy CSSフォールバックを残してください")
    require((ROOT / "timer-progress.css").exists(), "タイマー進捗CSSは後続PRまで残してください")

    print("Tailwind migration checks passed: Vite integration is active without Preflight and small React regions use utilities.")


if __name__ == "__main__":
    main()
