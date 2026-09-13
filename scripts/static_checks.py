from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
THEME_BOOTSTRAP_PATH = ROOT / "public" / "theme-bootstrap.js"
APP_PATH = ROOT / "src" / "App.jsx"
STORAGE_COMPONENT_PATH = ROOT / "src" / "components" / "StorageHealthStatus.jsx"
THEME_COMPONENT_PATH = ROOT / "src" / "components" / "ThemeSwitcher.jsx"
TIMER_STORE_PATH = ROOT / "src" / "features" / "timer" / "timerStore.js"
TIMER_GUARD_PATH = ROOT / "src" / "features" / "timer" / "timerStateGuard.js"
PROGRESS_STORE_PATH = ROOT / "src" / "features" / "progress" / "progressStore.js"
BACKUP_PANEL_PATH = ROOT / "src" / "features" / "backup" / "BackupPanel.jsx"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csp = []
        self.script_urls = []
        self.module_script_urls = []
        self.script_attributes = {}
        self.resource_urls = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append(values.get("content", ""))
        if tag == "script" and values.get("src"):
            src = values["src"]
            self.resource_urls.append(src)
            self.script_attributes[src] = values
            if values.get("type", "").lower() == "module":
                self.module_script_urls.append(src)
            else:
                self.script_urls.append(src)
        if tag == "link" and values.get("href"):
            self.resource_urls.append(values["href"])


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def require_tokens(source, tokens, label):
    for token in tokens:
        require(token in source, f"{label}に必要な要件がありません: {token}")


def main():
    parser = PageParser()
    parser.feed(INDEX_PATH.read_text(encoding="utf-8"))
    parser.close()

    require(len(parser.csp) == 1, "Content-Security-Policyを1つだけ維持してください")
    for directive in ("default-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"):
        require(directive in parser.csp[0], f"CSPに{directive}が必要です")

    require(parser.script_urls == ["theme-bootstrap.js"], "classic scriptはtheme-bootstrap.jsだけにしてください")
    require(parser.module_script_urls == ["/src/main.jsx"], "React entryは/src/main.jsxだけにしてください")
    require("defer" not in parser.script_attributes.get("theme-bootstrap.js", {}), "テーマbootstrapは初期描画前に実行してください")
    require(all(not url.startswith(("http://", "https://", "//")) for url in parser.resource_urls), "外部リソース参照は禁止です")

    for removed in (
        "styles.css",
        "timer-progress.css",
        "theme-bootstrap.js",
        "timer-bootstrap.js",
        "tab-guard.js",
        "app.js",
        "stats.js",
        "privacy-reset.js",
        "backup.js",
        "shortcuts.js",
        "custom-timer.js",
        "daily-goal-progress.js",
    ):
        require(not (ROOT / removed).exists(), f"削除済みlegacy assetを戻さないでください: {removed}")

    require(THEME_BOOTSTRAP_PATH.is_file(), "theme-bootstrap.jsはpublic配下へ置いてください")
    bootstrap = THEME_BOOTSTRAP_PATH.read_text(encoding="utf-8")
    require_tokens(bootstrap, (
        "THEME_STORAGE_KEY = 'one.theme.v1'",
        "new Set(['system', 'light', 'dark'])",
        "document.documentElement.dataset.theme = initialTheme",
    ), "theme bootstrap")

    app = APP_PATH.read_text(encoding="utf-8")
    storage = STORAGE_COMPONENT_PATH.read_text(encoding="utf-8")
    require("StorageHealthStatus" in app, "Appから端末保存状態を表示してください")
    require_tokens(storage, (
        'id="storage-health-status"',
        'role="status"',
        'aria-live="polite"',
        "window.addEventListener('one:storage-error', handleStorageError)",
    ), "StorageHealthStatus")

    timer_store = TIMER_STORE_PATH.read_text(encoding="utf-8")
    timer_guard = TIMER_GUARD_PATH.read_text(encoding="utf-8")
    require("import { timerStateGuard } from './timerStateGuard.js';" in timer_store, "タイマーストアはguardを直接importしてください")
    require("export const timerStateGuard = Object.freeze" in timer_guard, "タイマーguardをmodule APIとして維持してください")
    require("window.addEventListener('one:privacy-reset-prepare', preparePrivacyReset)" in timer_store, "データ削除前にタイマーを停止してください")

    progress_store = PROGRESS_STORE_PATH.read_text(encoding="utf-8")
    require_tokens(progress_store, (
        "DONE_COUNT_STORAGE_KEY = 'one.doneCount'",
        "HISTORY_STORAGE_KEY = 'one.history.v1'",
        "window.addEventListener('storage', syncProgressFromStorage)",
    ), "progress store")

    theme = THEME_COMPONENT_PATH.read_text(encoding="utf-8")
    require_tokens(theme, (
        "data-theme-choice={option.value}",
        'id="theme-status"',
        "window.addEventListener('storage', handleStorage)",
    ), "ThemeSwitcher")

    backup = BACKUP_PANEL_PATH.read_text(encoding="utf-8")
    for element_id in (
        "backup-export-button",
        "backup-import-button",
        "backup-undo-button",
        "data-reset-button",
        "data-reset-confirm-button",
        "data-reset-cancel-button",
    ):
        require(f'id="{element_id}"' in backup, f"BackupPanelに#{element_id}を維持してください")

    print("Static security, React ownership, and public asset boundaries passed.")


if __name__ == "__main__":
    main()
