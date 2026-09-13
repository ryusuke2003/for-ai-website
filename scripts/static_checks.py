import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
APP_PATH = ROOT / "app.js"
STORAGE_STATUS_PATH = ROOT / "storage-status.js"
SOUND_PATH = ROOT / "completion-sound.js"
WAKE_LOCK_PATH = ROOT / "wake-lock.js"
THEME_BOOTSTRAP_PATH = ROOT / "theme-bootstrap.js"
THEME_COMPONENT_PATH = ROOT / "src" / "components" / "ThemeSwitcher.jsx"
PRIVACY_RESET_PATH = ROOT / "privacy-reset.js"

REQUIRED_SCRIPT_ORDER = [
    "theme-bootstrap.js",
    "timer-bootstrap.js",
    "app.js",
    "legacy/interop/timer.js",
    "storage-status.js",
    "completion-sound.js",
    "wake-lock.js",
    "stats.js",
    "daily-goal-progress.js",
    "tab-guard.js",
    "backup.js",
    "custom-timer.js",
    "legacy/interop/settings-progress.js",
    "shortcuts.js",
    "privacy-reset.js",
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

    custom_minutes = require_runtime_element(parser, "custom-minutes", errors)
    require_runtime_element(parser, "custom-minutes-apply", errors)
    custom_preset = require_runtime_element(parser, "custom-preset", errors)
    custom_status = require_runtime_element(parser, "custom-minutes-status", errors)
    if custom_minutes is not None:
        fail_if(custom_minutes.get("type") != "number", "#custom-minutes は type=number にしてください", errors)
        fail_if(custom_minutes.get("min") != "1" or custom_minutes.get("max") != "180" or custom_minutes.get("step") != "1", "自由設定は1〜180分の整数にしてください", errors)
        fail_if(custom_minutes.get("aria-describedby") != "custom-minutes-status", "自由設定は状態説明を参照してください", errors)
    if custom_preset is not None:
        fail_if("hidden" not in custom_preset, "#custom-preset は非表示にしてください", errors)
    if custom_status is not None:
        fail_if(custom_status.get("role") != "status", "#custom-minutes-status は role=status を維持してください", errors)

    sound_toggle = require_runtime_element(parser, "completion-sound-toggle", errors)
    sound_status = require_runtime_element(parser, "completion-sound-status", errors)
    wake_toggle = require_runtime_element(parser, "wake-lock-toggle", errors)
    wake_status = require_runtime_element(parser, "wake-lock-status", errors)
    if sound_toggle is not None:
        fail_if(sound_toggle.get("aria-pressed") != "false", "完了音は初期状態でオフにしてください", errors)
    if sound_status is not None:
        fail_if(sound_status.get("role") != "status", "完了音状態は role=status を維持してください", errors)
    if wake_toggle is not None:
        fail_if(wake_toggle.get("aria-pressed") != "false", "画面維持は初期状態でオフにしてください", errors)
    if wake_status is not None:
        fail_if(wake_status.get("role") != "status", "画面維持状態は role=status を維持してください", errors)

    storage_health = require_runtime_element(parser, "storage-health-status", errors)
    if storage_health is not None:
        fail_if(storage_health.get("role") != "status" or storage_health.get("aria-live") != "polite", "端末保存状態はpoliteなstatusにしてください", errors)

    done_button = require_runtime_element(parser, "done-button", errors)
    discard_button = require_runtime_element(parser, "discard-button", errors)
    if done_button is not None:
        fail_if("disabled" not in done_button, "記録ボタンは初期状態でdisabledにしてください", errors)
    if discard_button is not None:
        fail_if("hidden" not in discard_button, "破棄ボタンは初期状態でhiddenにしてください", errors)

    for element_id in ("today-count", "week-count", "streak-count", "done-count", "streak-status"):
        require_runtime_element(parser, element_id, errors)

    activity_grid = require_runtime_element(parser, "activity-grid", errors)
    require_runtime_element(parser, "activity-summary", errors)
    if activity_grid is not None:
        fail_if(activity_grid.get("role") != "list", "#activity-grid は role=list を維持してください", errors)
        fail_if(activity_grid.get("aria-describedby") != "activity-summary", "activity-gridはsummaryを参照してください", errors)

    for element_id in ("backup-export-button", "backup-import-button", "backup-undo-button", "backup-file-input"):
        require_runtime_element(parser, element_id, errors)
    backup_undo = parser.by_id.get("backup-undo-button")
    backup_file = parser.by_id.get("backup-file-input")
    if backup_undo is not None:
        fail_if("hidden" not in backup_undo, "復元取り消しは初期状態でhiddenにしてください", errors)
    if backup_file is not None:
        fail_if(backup_file.get("type") != "file" or "hidden" not in backup_file or ".json" not in backup_file.get("accept", ""), "バックアップ入力は非表示のJSON file inputにしてください", errors)

    for element_id in ("data-reset-button", "data-reset-confirm", "data-reset-confirm-button", "data-reset-cancel-button", "data-reset-status"):
        require_runtime_element(parser, element_id, errors)
    reset_confirm = parser.by_id.get("data-reset-confirm")
    if reset_confirm is not None:
        fail_if("hidden" not in reset_confirm, "端末データ削除の最終確認は初期状態でhiddenにしてください", errors)

    fail_if(not parser.csp, "Content-Security-Policy が見つかりません", errors)
    if parser.csp:
        for directive in ("connect-src 'none'", "object-src 'none'", "base-uri 'none'"):
            fail_if(directive not in parser.csp[0], f"CSP に {directive} が必要です", errors)

    fail_if(parser.script_urls != REQUIRED_SCRIPT_ORDER, f"classic scriptの読み込み順は {REQUIRED_SCRIPT_ORDER} を維持してください", errors)
    fail_if(parser.module_script_urls != ["/src/main.jsx"], "React entryは /src/main.jsx のmodule scriptを1つだけにしてください", errors)

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

    javascript_source = "\n".join(script_sources)
    for token in (
        ".innerHTML",
        "insertAdjacentHTML",
        "document.write",
        "eval(",
        "new Function(",
        "fetch(",
        "XMLHttpRequest",
        "WebSocket(",
        "EventSource(",
        "navigator.sendBeacon",
        "localStorage.clear(",
    ):
        fail_if(token in javascript_source, f"禁止APIを検出しました: {token}", errors)

    app_source = APP_PATH.read_text(encoding="utf-8")
    required_timer_boundary_flow = """if (remainingSeconds <= 0) {
      finishTimer();
      return;
    }
    stopTimer('再開');"""
    fail_if(required_timer_boundary_flow not in app_source, "0秒到達時は一時停止より先にfinishTimerへ流してください", errors)
    fail_if("let storageAccessFailed = false;" not in app_source, "端末保存の失敗状態を保持してください", errors)
    fail_if("window.dispatchEvent(new Event('one:storage-error'));" not in app_source, "保存失敗時は全体へ通知してください", errors)

    storage_status_source = STORAGE_STATUS_PATH.read_text(encoding="utf-8") if STORAGE_STATUS_PATH.is_file() else ""
    fail_if("STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1'" not in storage_status_source, "端末保存確認は既存プローブキーを再利用してください", errors)
    fail_if("addEventListener('one:storage-error'" not in storage_status_source, "保存失敗を端末保存表示へ反映してください", errors)
    fail_if("localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token" not in storage_status_source, "保存プローブは読み戻し確認まで行ってください", errors)

    sound_source = SOUND_PATH.read_text(encoding="utf-8") if SOUND_PATH.is_file() else ""
    fail_if("const finishTimerWithoutCompletionSound = finishTimer;" not in sound_source, "完了音は既存finishTimerを拡張してください", errors)
    fail_if("finishTimerWithoutCompletionSound();" not in sound_source, "完了音より先に本来の完了処理を実行してください", errors)

    wake_source = WAKE_LOCK_PATH.read_text(encoding="utf-8") if WAKE_LOCK_PATH.is_file() else ""
    fail_if("navigator.wakeLock.request('screen')" not in wake_source, "Screen Wake Lock APIのscreenロックだけを使用してください", errors)
    fail_if("document.visibilityState !== 'visible'" not in wake_source, "非表示タブではWake Lockを取得しないでください", errors)
    fail_if("window.addEventListener('pagehide'" not in wake_source, "ページ離脱時はWake Lockを解放してください", errors)

    bootstrap_source = THEME_BOOTSTRAP_PATH.read_text(encoding="utf-8") if THEME_BOOTSTRAP_PATH.is_file() else ""
    theme_component = THEME_COMPONENT_PATH.read_text(encoding="utf-8") if THEME_COMPONENT_PATH.is_file() else ""
    fail_if("THEME_STORAGE_KEY = 'one.theme.v1'" not in bootstrap_source, "表示テーマ保存キーの互換性を維持してください", errors)
    fail_if("['system', 'light', 'dark']" not in bootstrap_source, "初期描画のテーマ許可値を限定してください", errors)
    fail_if("data-theme-choice={option.value}" not in theme_component, "テーマUIはReact側でdata-theme-choiceを維持してください", errors)
    fail_if("document.documentElement.dataset.theme = theme" not in theme_component, "React側で手動テーマをdocumentElementへ反映してください", errors)
    fail_if('id="theme-status"' not in theme_component, "ReactテーマUIに読み上げ状態を維持してください", errors)

    privacy_reset_source = PRIVACY_RESET_PATH.read_text(encoding="utf-8") if PRIVACY_RESET_PATH.is_file() else ""
    fail_if("PRIVACY_RESET_KEYS = new Set([" not in privacy_reset_source, "削除対象キーは明示Setで管理してください", errors)
    storage_keys = set(re.findall(r"['\"](one\.[A-Za-z0-9.]+)['\"]", javascript_source + "\n" + theme_component))
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
