import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
APP_PATH = ROOT / "app.js"
REACT_APP_PATH = ROOT / "src" / "App.jsx"
STORAGE_COMPONENT_PATH = ROOT / "src" / "components" / "StorageHealthStatus.jsx"
THEME_BOOTSTRAP_PATH = ROOT / "theme-bootstrap.js"
THEME_COMPONENT_PATH = ROOT / "src" / "components" / "ThemeSwitcher.jsx"
TIMER_SETTINGS_PATH = ROOT / "src" / "features" / "timer" / "TimerSettings.jsx"
TIMER_DISPLAY_PATH = ROOT / "src" / "features" / "timer" / "TimerDisplay.jsx"
CUSTOM_TIMER_HOOK_PATH = ROOT / "src" / "features" / "timer" / "useCustomTimerControl.js"
WAKE_LOCK_HOOK_PATH = ROOT / "src" / "features" / "timer" / "useWakeLockControl.js"
COMPLETION_EFFECTS_HOOK_PATH = ROOT / "src" / "features" / "timer" / "useCompletionEffectsControl.js"
DAILY_GOAL_HOOK_PATH = ROOT / "src" / "features" / "progress" / "useDailyGoalControl.js"
PROGRESS_INSIGHTS_PATH = ROOT / "src" / "features" / "progress" / "progressInsights.js"
BACKUP_PANEL_PATH = ROOT / "src" / "features" / "backup" / "BackupPanel.jsx"
PRIVACY_RESET_HOOK_PATH = ROOT / "src" / "features" / "backup" / "usePrivacyResetControl.js"

REQUIRED_SCRIPT_ORDER = [
    "theme-bootstrap.js",
    "timer-bootstrap.js",
    "app.js",
    "legacy/interop/timer.js",
    "tab-guard.js",
    "backup.js",
    "legacy/interop/settings-progress.js",
    "shortcuts.js",
    "legacy/interop/progress-backup.js",
]


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.by_id = {}
        self.csp = []
        self.resource_urls = []
        self.resource_order = []
        self.script_urls = []
        self.module_script_urls = []
        self.script_attributes = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.by_id[element_id] = values
        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append(values.get("content", ""))
        if tag == "script" and values.get("src"):
            src = values["src"]
            self.resource_urls.append(src)
            self.resource_order.append(("script", src))
            self.script_attributes[src] = values
            if values.get("type", "").lower() == "module":
                self.module_script_urls.append(src)
            else:
                self.script_urls.append(src)
        if tag == "link" and values.get("href"):
            href = values["href"]
            self.resource_urls.append(href)
            self.resource_order.append(("link", href))


def fail_if(condition, message, errors):
    if condition:
        errors.append(message)


def require_runtime_element(parser, element_id, errors):
    element = parser.by_id.get(element_id)
    fail_if(element is None, f"#{element_id} がruntime scaffoldに見つかりません", errors)
    return element


def main():
    errors = []
    parser = PageParser()
    parser.feed(INDEX_PATH.read_text(encoding="utf-8"))
    parser.close()

    scaffold = require_runtime_element(parser, "legacy-runtime-scaffold", errors)
    if scaffold is not None:
        fail_if("hidden" not in scaffold, "legacy runtime scaffoldは画面に表示しないでください", errors)
        fail_if(scaffold.get("aria-hidden") != "true", "legacy runtime scaffoldは支援技術からも隠してください", errors)

    timer = require_runtime_element(parser, "timer", errors)
    if timer is not None:
        fail_if(timer.get("role") != "timer", "#timer は role=timer を維持してください", errors)
        fail_if("aria-live" in timer, "#timer に aria-live を付けないでください", errors)

    custom_preset = require_runtime_element(parser, "custom-preset", errors)
    if custom_preset is not None:
        fail_if("hidden" not in custom_preset, "#custom-preset は非表示にしてください", errors)

    for element_id in (
        "done-button", "discard-button", "done-count",
        "backup-export-button", "backup-import-button", "backup-undo-button", "backup-file-input",
    ):
        require_runtime_element(parser, element_id, errors)

    for removed_id in (
        "today-count", "week-count", "streak-count", "streak-status", "history-grid", "activity-grid", "activity-summary",
        "data-reset-button", "data-reset-confirm", "data-reset-confirm-button", "data-reset-cancel-button", "data-reset-status",
    ):
        fail_if(removed_id in parser.by_id, f"#{removed_id} はReact管理なのでruntime scaffoldへ戻さないでください", errors)

    fail_if(not parser.csp, "Content-Security-Policy が見つかりません", errors)
    if parser.csp:
        for directive in ("connect-src 'none'", "object-src 'none'", "base-uri 'none'"):
            fail_if(directive not in parser.csp[0], f"CSP に {directive} が必要です", errors)

    fail_if(parser.script_urls != REQUIRED_SCRIPT_ORDER, f"classic scriptの読み込み順は {REQUIRED_SCRIPT_ORDER} を維持してください", errors)
    fail_if(parser.module_script_urls != ["/src/main.jsx"], "React entryは /src/main.jsx のmodule scriptを1つだけにしてください", errors)
    fail_if((ROOT / "stats.js").exists(), "React移行後はstats.jsを残さないでください", errors)
    fail_if((ROOT / "privacy-reset.js").exists(), "React移行後はprivacy-reset.jsを残さないでください", errors)

    theme_bootstrap_attrs = parser.script_attributes.get("theme-bootstrap.js", {})
    fail_if("defer" in theme_bootstrap_attrs, "theme-bootstrap.js は初期描画前に実行してください", errors)
    try:
        theme_bootstrap_position = parser.resource_order.index(("script", "theme-bootstrap.js"))
        stylesheet_position = parser.resource_order.index(("link", "styles.css"))
        fail_if(theme_bootstrap_position > stylesheet_position, "theme-bootstrap.js は styles.css より前に読み込んでください", errors)
    except ValueError:
        errors.append("theme-bootstrap.js または styles.css の位置を確認できません")

    for url in parser.resource_urls:
        fail_if(url.startswith(("http://", "https://", "//")), f"外部リソース参照は禁止です: {url}", errors)

    script_sources = []
    for url in parser.script_urls:
        script_ref = Path(url)
        unsafe_path = script_ref.is_absolute() or ".." in script_ref.parts
        fail_if(unsafe_path, f"安全でないスクリプトパスです: {url}", errors)
        if unsafe_path:
            continue
        script_path = ROOT / script_ref
        fail_if(not script_path.is_file(), f"読み込み対象のJavaScriptが見つかりません: {url}", errors)
        if script_path.is_file():
            script_sources.append(script_path.read_text(encoding="utf-8"))

    app_source = APP_PATH.read_text(encoding="utf-8")
    required_timer_boundary_flow = """if (remainingSeconds <= 0) {
      finishTimer();
      return;
    }
    stopTimer('再開');"""
    fail_if(required_timer_boundary_flow not in app_source, "0秒到達時は一時停止より先にfinishTimerへ流してください", errors)
    fail_if("let storageAccessFailed = false;" not in app_source, "端末保存の失敗状態を保持してください", errors)
    fail_if("window.dispatchEvent(new Event('one:storage-error'));" not in app_source, "保存失敗時は全体へ通知してください", errors)

    react_app_source = REACT_APP_PATH.read_text(encoding="utf-8")
    storage_component = STORAGE_COMPONENT_PATH.read_text(encoding="utf-8")
    fail_if("StorageHealthStatus" not in react_app_source, "React Appから端末保存状態を表示してください", errors)
    fail_if('id="storage-health-status"' not in storage_component, "端末保存状態はReact UIに表示してください", errors)
    fail_if('role="status"' not in storage_component or 'aria-live="polite"' not in storage_component, "端末保存状態はpoliteなstatusにしてください", errors)
    fail_if("STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1'" not in storage_component, "端末保存確認は既存プローブキーを再利用してください", errors)
    fail_if("window.addEventListener('one:storage-error', handleStorageError)" not in storage_component, "保存失敗をReact端末保存表示へ反映してください", errors)
    fail_if("localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token" not in storage_component, "保存プローブは読み戻し確認まで行ってください", errors)

    bootstrap_source = THEME_BOOTSTRAP_PATH.read_text(encoding="utf-8")
    theme_component = THEME_COMPONENT_PATH.read_text(encoding="utf-8")
    fail_if("THEME_STORAGE_KEY = 'one.theme.v1'" not in bootstrap_source, "表示テーマ保存キーの互換性を維持してください", errors)
    fail_if("['system', 'light', 'dark']" not in bootstrap_source, "初期描画のテーマ許可値を限定してください", errors)
    fail_if("data-theme-choice={option.value}" not in theme_component, "テーマUIはReact側でdata-theme-choiceを維持してください", errors)
    fail_if('id="theme-status"' not in theme_component, "ReactテーマUIに読み上げ状態を維持してください", errors)

    timer_settings = TIMER_SETTINGS_PATH.read_text(encoding="utf-8")
    custom_timer_hook = CUSTOM_TIMER_HOOK_PATH.read_text(encoding="utf-8")
    timer_display = TIMER_DISPLAY_PATH.read_text(encoding="utf-8")
    fail_if('id="custom-minutes"' not in timer_settings, "自由設定入力はReact UIに置いてください", errors)
    fail_if('min="1"' not in timer_settings or 'max="180"' not in timer_settings, "自由設定は1〜180分に限定してください", errors)
    fail_if("ONE_REACT_TIMER_CONTROLS?.[action]" not in custom_timer_hook, "自由設定操作はtimer interopへ委譲してください", errors)
    fail_if("window.addEventListener('one:idle-timer-sync', handleIdleTimerSync)" not in custom_timer_hook, "別タブのアイドル設定変更をReactへ同期してください", errors)
    fail_if("document.title = documentTitleFor(state, timeText);" not in timer_display, "ページタイトルはReactタイマー状態から同期してください", errors)

    wake_lock_hook = WAKE_LOCK_HOOK_PATH.read_text(encoding="utf-8")
    fail_if("WAKE_LOCK_STORAGE_KEY = 'one.wakeLock.v1'" not in wake_lock_hook, "Wake Lock保存キーの互換性を維持してください", errors)
    fail_if("navigator.wakeLock.request('screen')" not in wake_lock_hook, "Wake LockはReact hookからscreenロックを要求してください", errors)

    completion_effects_hook = COMPLETION_EFFECTS_HOOK_PATH.read_text(encoding="utf-8")
    fail_if("COMPLETION_SOUND_STORAGE_KEY = 'one.completionSound.v1'" not in completion_effects_hook, "完了音保存キーの互換性を維持してください", errors)
    fail_if("COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1'" not in completion_effects_hook, "完了通知保存キーの互換性を維持してください", errors)
    fail_if("Notification.requestPermission()" not in completion_effects_hook, "完了通知はReact hookから明示的に許可を要求してください", errors)
    fail_if("new Notification('集中スプリント完了'" not in completion_effects_hook, "完了通知の固定タイトルを維持してください", errors)

    daily_goal_hook = DAILY_GOAL_HOOK_PATH.read_text(encoding="utf-8")
    fail_if("DAILY_GOAL_STORAGE_KEY = 'one.dailyGoal.v1'" not in daily_goal_hook,
            "日次目標保存キーの互換性を維持してください", errors)

    progress_insights = PROGRESS_INSIGHTS_PATH.read_text(encoding="utf-8")
    fail_if("buildProgressInsights" not in react_app_source, "進捗集計はReact Appから利用してください", errors)
    fail_if("calculateCurrentWeekCount" not in progress_insights or "calculateCurrentStreak" not in progress_insights,
            "週次回数と連続日集計をReact featureへ維持してください", errors)
    fail_if("calculateActivityWindow" not in progress_insights,
            "30日アクティビティ集計をReact featureへ維持してください", errors)

    backup_panel_source = BACKUP_PANEL_PATH.read_text(encoding="utf-8")
    privacy_reset_source = PRIVACY_RESET_HOOK_PATH.read_text(encoding="utf-8")
    for element_id in (
        "data-reset-button", "data-reset-confirm", "data-reset-confirm-button", "data-reset-cancel-button", "data-reset-status",
    ):
        fail_if(f'id="{element_id}"' not in backup_panel_source,
                f"React backup panelに#{element_id}を維持してください", errors)
    fail_if("usePrivacyResetControl" not in backup_panel_source,
            "端末データ削除UIはReact hookを利用してください", errors)
    fail_if("PRIVACY_RESET_KEYS = new Set([" not in privacy_reset_source,
            "削除対象キーはReact hook内の明示Setで管理してください", errors)

    storage_source = "\n".join([
        *script_sources,
        storage_component,
        theme_component,
        custom_timer_hook,
        wake_lock_hook,
        completion_effects_hook,
        daily_goal_hook,
        privacy_reset_source,
    ])
    storage_keys = set(re.findall(r"['\"](one\.[A-Za-z0-9.]+)['\"]", storage_source))
    for storage_key in sorted(storage_keys):
        represented = f"'{storage_key}'" in privacy_reset_source or f'"{storage_key}"' in privacy_reset_source
        fail_if(not represented, f"保存キー {storage_key} が端末データ削除対象に含まれていません", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)

    print("Static security and accessibility checks passed.")


if __name__ == "__main__":
    main()
