from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
THEME_COMPONENT_PATH = ROOT / "src" / "components" / "ThemeSwitcher.jsx"
THEME_BOOTSTRAP_PATH = ROOT / "theme-bootstrap.js"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    theme = THEME_COMPONENT_PATH.read_text(encoding="utf-8")
    bootstrap = THEME_BOOTSTRAP_PATH.read_text(encoding="utf-8")

    require("const THEME_STORAGE_KEY = 'one.theme.v1';" in theme, "React側のテーマ保存キーを維持してください")
    require("new Set(['system', 'light', 'dark'])" in theme, "テーマ許可値は system / light / dark に限定してください")
    require("localStorage.setItem(THEME_STORAGE_KEY, theme)" in theme, "テーマ変更は端末へ保存してください")
    require("localStorage.getItem(THEME_STORAGE_KEY) === theme" in theme, "テーマ保存後は読み戻して一致確認してください")
    require("reportThemeStorageFailure();" in theme, "テーマ保存失敗は端末保存障害として通知してください")
    require("document.documentElement.dataset.theme = theme" in theme, "手動テーマは documentElement の data-theme へ反映してください")
    require("document.documentElement.removeAttribute('data-theme')" in theme, "自動テーマでは手動 data-theme を解除してください")

    require("window.addEventListener('storage', handleStorage);" in theme, "別タブのテーマ変更を同期してください")
    require("event.newValue !== null && !VALID_THEMES.has(event.newValue)" in theme, "別タブ由来の不正テーマ値を拒否してください")
    require("const nextTheme = event.newValue ?? 'system';" in theme, "保存値削除は自動テーマへ戻してください")
    require("document.addEventListener('visibilitychange', refreshThemeWhenVisible);" in theme, "前面復帰時にテーマを再同期してください")
    require("document.visibilityState === 'visible'" in theme, "背景へ移るだけではテーマを再読込しないでください")
    require("window.addEventListener('pageshow', refreshThemePreferenceFromStorage);" in theme, "BFCache復元時もテーマを再同期してください")
    require("このブラウザには設定を保存できませんでした。" in theme, "保存失敗を利用者へ説明してください")

    require("const THEME_STORAGE_KEY = 'one.theme.v1';" in bootstrap, "初期描画用テーマキーをReact側と合わせてください")
    require("new Set(['system', 'light', 'dark'])" in bootstrap, "初期描画でもテーマ許可値を限定してください")
    require("document.documentElement.dataset.theme = initialTheme" in bootstrap, "初期描画で保存済み手動テーマを先に反映してください")

    print("Theme preference is owned by React while the tiny bootstrap prevents theme flash.")


if __name__ == "__main__":
    main()
