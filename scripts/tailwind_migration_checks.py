import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
VITE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")
MAIN = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
TAILWIND = (ROOT / "src/tailwind.css").read_text(encoding="utf-8")
APP = (ROOT / "src/App.jsx").read_text(encoding="utf-8")
HERO = (ROOT / "src/components/HeroIntro.jsx").read_text(encoding="utf-8")
THEME = (ROOT / "src/components/ThemeSwitcher.jsx").read_text(encoding="utf-8")
FOOTER = (ROOT / "src/components/AppFooter.jsx").read_text(encoding="utf-8")
TIMER_CONTROLS = (ROOT / "src/features/timer/TimerControls.jsx").read_text(encoding="utf-8")
TIMER_DISPLAY = (ROOT / "src/features/timer/TimerDisplay.jsx").read_text(encoding="utf-8")
TIMER_SETTINGS = (ROOT / "src/features/timer/TimerSettings.jsx").read_text(encoding="utf-8")
PROGRESS_OVERVIEW = (ROOT / "src/features/progress/ProgressOverview.jsx").read_text(encoding="utf-8")
PROGRESS_DETAILS = (ROOT / "src/features/progress/ProgressDetails.jsx").read_text(encoding="utf-8")
BACKUP_PANEL = (ROOT / "src/features/backup/BackupPanel.jsx").read_text(encoding="utf-8")
STYLES_SHIM = ROOT / "styles.css"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def require_tokens(source, tokens, label):
    for token in tokens:
        require(token in source, f"{label}のTailwind移行要件がありません: {token}")


def main():
    dev_dependencies = PACKAGE.get("devDependencies", {})
    require(dev_dependencies.get("tailwindcss") == "4.3.3", "Tailwind CSS 4.3.3を固定してください")
    require(dev_dependencies.get("@tailwindcss/vite") == "4.3.3", "Tailwind Vite plugin 4.3.3を固定してください")

    require("import tailwindcss from '@tailwindcss/vite';" in VITE, "ViteでTailwind pluginを読み込んでください")
    require("tailwindcss()" in VITE, "Vite pluginsにTailwindを登録してください")
    require("import './tailwind.css';" in MAIN, "ReactエントリからTailwind CSSを読み込んでください")
    require('tailwindcss/theme.css' in TAILWIND, "Tailwind theme layerを読み込んでください")
    require('tailwindcss/utilities.css' in TAILWIND, "Tailwind utilities layerを読み込んでください")
    require('tailwindcss/preflight.css' not in TAILWIND, "Preflightを意図せず有効化しないでください")

    require_tokens(HERO, ("text-[clamp(2.8rem,10vw,6.6rem)]", "text-[var(--one-muted-strong)]"), "Hero")
    require_tokens(THEME, ("max-[560px]:justify-start", "bg-[var(--one-active-bg)]", "text-[var(--one-subtle)]"), "ThemeSwitcher")
    require("text-[var(--one-subtle)]" in FOOTER, "Footerのテーマ配色をCSS変数へ寄せてください")
    require_tokens(APP, ("rounded-3xl border border-[var(--one-border)]", "bg-[var(--one-card)]", "max-[560px]:rounded-[20px]", "max-[560px]:pt-11"), "App layout")
    require_tokens(TIMER_CONTROLS, ("border-[var(--one-control-border)]", "bg-[var(--one-primary-bg)]", "aria-pressed:bg-[var(--one-active-bg)]"), "TimerControls")
    require_tokens(TIMER_DISPLAY, ("timer my-2 mb-6", "text-[var(--one-muted-strong)]", "text-[clamp(4.5rem,18vw,8.5rem)]"), "TimerDisplay")
    require_tokens(TIMER_SETTINGS, ("presets mt-[18px] flex flex-wrap justify-center gap-2.5", "bg-[var(--one-active-bg)]", "border-[var(--one-control-border-soft)]", "max-[560px]:w-full"), "TimerSettings")
    require_tokens(PROGRESS_OVERVIEW, ("bg-[var(--one-stat-bg)]", "border-[var(--one-control-border)]", "text-[var(--one-subtle)]"), "ProgressOverview")
    require_tokens(PROGRESS_DETAILS, ("grid grid-cols-7 items-end gap-2", "grid-rows-[repeat(7,14px)]", "ACTIVITY_LEVEL_CLASS", "HISTORY_LEVEL_CLASS", "max-[560px]:grid-rows-[repeat(7,12px)]"), "ProgressDetails")
    require_tokens(BACKUP_PANEL, ("border-[var(--one-control-border)]", "border-[var(--one-border-soft)]", "bg-[var(--one-primary-bg)]"), "BackupPanel")

    for token in (
        "--one-card:",
        "--one-activity-4:",
        "@media (prefers-color-scheme: dark)",
        ".timer-progress {",
        ".daily-goal-progress {",
        "body.focus-mode .timer-card {",
        "button:focus-visible,",
    ):
        require(token in TAILWIND, f"共通CSS基盤がsrc/tailwind.cssにありません: {token}")

    require(STYLES_SHIM.exists(), "初期描画順の互換shim styles.cssを維持してください")
    shim = STYLES_SHIM.read_text(encoding="utf-8")
    require("Compatibility shim" in shim, "styles.cssは互換shimであることを明示してください")
    require(STYLES_SHIM.stat().st_size < 160, "styles.cssへ実スタイルを戻さないでください")
    require(not (ROOT / "timer-progress.css").exists(), "timer-progress.cssを復活させないでください")

    print("Tailwind migration checks passed: runtime styles live in src/tailwind.css; styles.css is only a tiny loading-order compatibility shim.")


if __name__ == "__main__":
    main()
