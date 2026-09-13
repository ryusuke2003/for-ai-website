import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
VITE = (ROOT / "vite.config.mjs").read_text(encoding="utf-8")
MAIN = (ROOT / "src/main.jsx").read_text(encoding="utf-8")
TAILWIND = (ROOT / "src/tailwind.css").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    dev_dependencies = PACKAGE.get("devDependencies", {})
    require(dev_dependencies.get("tailwindcss") == "4.3.3", "Tailwind CSS 4.3.3を固定してください")
    require(dev_dependencies.get("@tailwindcss/vite") == "4.3.3", "Tailwind Vite plugin 4.3.3を固定してください")
    require("import tailwindcss from '@tailwindcss/vite';" in VITE, "ViteでTailwind pluginを読み込んでください")
    require("tailwindcss()" in VITE, "Vite pluginsにTailwindを登録してください")
    require("emitClassicScriptsFromIndex" not in VITE, "public assetへ移したclassic scriptの独自emit処理を戻さないでください")
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
    require(not (ROOT / "styles.css").exists(), "legacy styles.cssを復活させないでください")
    require(not (ROOT / "timer-progress.css").exists(), "timer-progress.cssを復活させないでください")
    require((ROOT / "public" / "theme-bootstrap.js").exists(), "theme bootstrapはpublic assetとして維持してください")
    require(not (ROOT / "theme-bootstrap.js").exists(), "theme bootstrapをrootへ戻さないでください")

    print("Tailwind migration checks passed: runtime styles use src/tailwind.css and the theme bootstrap is a Vite public asset.")


if __name__ == "__main__":
    main()
