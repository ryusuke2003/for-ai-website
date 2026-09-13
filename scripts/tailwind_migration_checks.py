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
TIMER_CONTROLS = (ROOT / "src/features/timer/TimerControls.jsx").read_text(encoding="utf-8")
TIMER_DISPLAY = (ROOT / "src/features/timer/TimerDisplay.jsx").read_text(encoding="utf-8")
TIMER_SETTINGS = (ROOT / "src/features/timer/TimerSettings.jsx").read_text(encoding="utf-8")


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

    for token in (
        "min-h-12 rounded-full border border-[#1d1d1f]",
        "bg-[#1d1d1f] text-white",
        "aria-pressed:bg-[#e3ded4]",
    ):
        require(token in TIMER_CONTROLS, f"TimerControlsのTailwind移行要件がありません: {token}")

    for token in (
        "text-[clamp(4.5rem,18vw,8.5rem)]",
        "[font-variant-numeric:tabular-nums]",
        "min-h-[1.4em] text-[0.88rem]",
    ):
        require(token in TIMER_DISPLAY, f"TimerDisplayのTailwind移行要件がありません: {token}")

    for token in (
        "mt-[18px] flex flex-wrap justify-center gap-2.5",
        "rounded-full border-0 bg-transparent",
        "aria-invalid:border-2 aria-invalid:border-current",
    ):
        require(token in TIMER_SETTINGS, f"TimerSettingsのTailwind移行要件がありません: {token}")

    require((ROOT / "styles.css").exists(), "段階移行中はlegacy CSSフォールバックを残してください")
    require((ROOT / "timer-progress.css").exists(), "タイマー進捗CSSは疑似要素の移行まで残してください")

    print("Tailwind migration checks passed: core timer UI now uses utilities while progress pseudo-element CSS remains isolated.")


if __name__ == "__main__":
    main()
