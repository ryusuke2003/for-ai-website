import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
VITE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")
MAIN = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
TAILWIND = (ROOT / "src/tailwind.css").read_text(encoding="utf-8")
STYLES_SHIM = ROOT / "styles.css"


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

    for token in (
        'tailwindcss/theme.css',
        'tailwindcss/utilities.css',
        '--one-card:',
        '--one-activity-4:',
        '@media (prefers-color-scheme: dark)',
        'body.focus-mode .timer-card {',
        'button:focus-visible,',
        '.timer-progress {',
        '.daily-goal-progress {',
    ):
        require(token in TAILWIND, f"src/tailwind.cssの共通スタイルが不足しています: {token}")

    require('tailwindcss/preflight.css' not in TAILWIND, "Preflightを意図せず有効化しないでください")
    require(STYLES_SHIM.exists(), "初期描画順の互換styles.cssを維持してください")
    shim = STYLES_SHIM.read_text(encoding="utf-8")
    require("Compatibility shim" in shim, "styles.cssは互換shimであることを明示してください")
    require(STYLES_SHIM.stat().st_size < 160, "styles.cssへ実スタイルを戻さないでください")
    require((ROOT / "timer-progress.css").exists(), "進捗CSSの完全撤去は後続ステップまで分離してください")

    print("Tailwind migration checks passed: runtime theme/focus styles are centralized in src/tailwind.css.")


if __name__ == "__main__":
    main()
