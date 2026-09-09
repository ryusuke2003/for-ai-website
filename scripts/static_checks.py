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
THEME_PATH = ROOT / "theme.js"
PRIVACY_RESET_PATH = ROOT / "privacy-reset.js"
REQUIRED_SCRIPT_ORDER = [
    "theme-bootstrap.js",
    "timer-bootstrap.js",
    "app.js",
    "storage-status.js",
    "completion-sound.js",
    "wake-lock.js",
    "theme.js",
    "stats.js",
    "daily-goal-progress.js",
    "tab-guard.js",
    "backup.js",
    "custom-timer.js",
    "shortcuts.js",
    "privacy-reset.js",
]


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.by_id = {}
        self.csp = []
        self.resource_urls = []
        self.resource_order = []
        self.script_urls = []
        self.script_attributes = {}
        self.theme_choices = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.by_id[element_id] = values

        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append(values.get("content", ""))

        if tag == "button" and values.get("data-theme-choice"):
            self.theme_choices.append(values)

        if tag == "script" and values.get("src"):
            src = values["src"]
            self.resource_urls.append(src)
            self.resource_order.append(("script", src))
            self.script_urls.append(src)
            self.script_attributes[src] = values
        if tag == "link" and values.get("href"):
            href = values["href"]
            self.resource_urls.append(href)
            self.resource_order.append(("link", href))


def fail_if(condition, message, errors):
    if condition:
        errors.append(message)


def main():
    errors = []
    parser = PageParser()
    parser.feed(INDEX_PATH.read_text(encoding="utf-8"))
    parser.close()

    timer = parser.by_id.get("timer")
    fail_if(timer is None, "#timer が見つかりません", errors)
    if timer is not None:
        fail_if(timer.get("role") != "timer", "#timer は role=timer を維持してください", errors)
        fail_if("aria-live" in timer, "#timer に aria-live を付けないでください。毎秒の読み上げにつながります", errors)

    custom_minutes = parser.by_id.get("custom-minutes")
    custom_apply = parser.by_id.get("custom-minutes-apply")
    custom_preset = parser.by_id.get("custom-preset")
    custom_status = parser.by_id.get("custom-minutes-status")
    fail_if(custom_minutes is None, "#custom-minutes が見つかりません", errors)
    fail_if(custom_apply is None, "#custom-minutes-apply が見つかりません", errors)
    fail_if(custom_preset is None, "#custom-preset が見つかりません", errors)
    fail_if(custom_status is None, "#custom-minutes-status が見つかりません", errors)
    if custom_minutes is not None:
        fail_if(custom_minutes.get("type") != "number", "#custom-minutes は type=number にしてください", errors)
        fail_if(custom_minutes.get("min") != "1", "#custom-minutes の min は 1 にしてください", errors)
        fail_if(custom_minutes.get("max") != "180", "#custom-minutes の max は 180 にしてください", errors)
        fail_if(custom_minutes.get("step") != "1", "#custom-minutes の step は 1 にしてください", errors)
        fail_if(
            custom_minutes.get("aria-describedby") != "custom-minutes-status",
            "#custom-minutes は #custom-minutes-status を説明として参照してください",
            errors,
        )
    if custom_preset is not None:
        fail_if("hidden" not in custom_preset, "#custom-preset は画面に表示しないでください", errors)
        fail_if("data-minutes" not in custom_preset, "#custom-preset は data-minutes を維持してください", errors)
    if custom_status is not None:
        fail_if(custom_status.get("role") != "status", "#custom-minutes-status は role=status を維持してください", errors)

    sound_toggle = parser.by_id.get("completion-sound-toggle")
    sound_status = parser.by_id.get("completion-sound-status")
    fail_if(sound_toggle is None, "#completion-sound-toggle が見つかりません", errors)
    fail_if(sound_status is None, "#completion-sound-status が見つかりません", errors)
    if sound_toggle is not None:
        fail_if(
            sound_toggle.get("aria-pressed") != "false",
            "完了音は初期HTMLでオフにしてください",
            errors,
        )
        fail_if(
            sound_toggle.get("aria-describedby") != "completion-sound-status",
            "#completion-sound-toggle は #completion-sound-status を説明として参照してください",
            errors,
        )
    if sound_status is not None:
        fail_if(sound_status.get("role") != "status", "#completion-sound-status は role=status を維持してください", errors)

    wake_lock_toggle = parser.by_id.get("wake-lock-toggle")
    wake_lock_status = parser.by_id.get("wake-lock-status")
    fail_if(wake_lock_toggle is None, "#wake-lock-toggle が見つかりません", errors)
    fail_if(wake_lock_status is None, "#wake-lock-status が見つかりません", errors)
    if wake_lock_toggle is not None:
        fail_if(
            wake_lock_toggle.get("aria-pressed") != "false",
            "画面維持は初期HTMLでオフにしてください",
            errors,
        )
        fail_if(
            wake_lock_toggle.get("aria-describedby") != "wake-lock-status",
            "#wake-lock-toggle は #wake-lock-status を説明として参照してください",
            errors,
        )
    if wake_lock_status is not None:
        fail_if(wake_lock_status.get("role") != "status", "#wake-lock-status は role=status を維持してください", errors)

    theme_status = parser.by_id.get("theme-status")
    fail_if(theme_status is None, "#theme-status が見つかりません", errors)
    if theme_status is not None:
        fail_if(theme_status.get("role") != "status", "#theme-status は role=status を維持してください", errors)

    theme_values = [choice.get("data-theme-choice") for choice in parser.theme_choices]
    fail_if(theme_values != ["system", "light", "dark"], "表示テーマは自動・ライト・ダークの3択を維持してください", errors)
    if len(parser.theme_choices) == 3:
        fail_if(parser.theme_choices[0].get("aria-pressed") != "true", "表示テーマの初期選択は自動にしてください", errors)
        for choice in parser.theme_choices[1:]:
            fail_if(choice.get("aria-pressed") != "false", "ライト・ダークは初期HTMLで未選択にしてください", errors)

    storage_health_status = parser.by_id.get("storage-health-status")
    fail_if(storage_health_status is None, "#storage-health-status が見つかりません", errors)
    if storage_health_status is not None:
        fail_if(storage_health_status.get("role") != "status", "#storage-health-status は role=status を維持してください", errors)
        fail_if(storage_health_status.get("aria-live") != "polite", "#storage-health-status は aria-live=polite を維持してください", errors)

    done_button = parser.by_id.get("done-button")
    fail_if(done_button is None, "#done-button が見つかりません", errors)
    if done_button is not None:
        fail_if("disabled" not in done_button, "#done-button は初期状態で disabled にしてください", errors)

    discard_button = parser.by_id.get("discard-button")
    fail_if(discard_button is None, "#discard-button が見つかりません", errors)
    if discard_button is not None:
        fail_if("hidden" not in discard_button, "#discard-button は初期状態で hidden にしてください", errors)

    for element_id in ("today-count", "week-count", "streak-count", "done-count", "streak-status"):
        fail_if(parser.by_id.get(element_id) is None, f"#{element_id} が見つかりません", errors)

    streak_count = parser.by_id.get("streak-count")
    if streak_count is not None:
        fail_if("aria-label" not in streak_count, "#streak-count は日数を読み上げられる aria-label を維持してください", errors)

    activity_grid = parser.by_id.get("activity-grid")
    activity_summary = parser.by_id.get("activity-summary")
    fail_if(activity_grid is None, "#activity-grid が見つかりません", errors)
    fail_if(activity_summary is None, "#activity-summary が見つかりません", errors)
    if activity_grid is not None:
        fail_if(activity_grid.get("role") != "list", "#activity-grid は role=list を維持してください", errors)
        fail_if(
            activity_grid.get("aria-describedby") != "activity-summary",
            "#activity-grid は #activity-summary を説明として参照してください",
            errors,
        )

    backup_export = parser.by_id.get("backup-export-button")
    backup_import = parser.by_id.get("backup-import-button")
    backup_undo = parser.by_id.get("backup-undo-button")
    backup_file = parser.by_id.get("backup-file-input")
    fail_if(backup_export is None, "#backup-export-button が見つかりません", errors)
    fail_if(backup_import is None, "#backup-import-button が見つかりません", errors)
    fail_if(backup_undo is None, "#backup-undo-button が見つかりません", errors)
    fail_if(backup_file is None, "#backup-file-input が見つかりません", errors)
    if backup_undo is not None:
        fail_if("hidden" not in backup_undo, "#backup-undo-button は初期状態で hidden にしてください", errors)
    if backup_file is not None:
        fail_if(backup_file.get("type") != "file", "#backup-file-input は type=file にしてください", errors)
        fail_if("hidden" not in backup_file, "#backup-file-input は初期状態で hidden にしてください", errors)
        fail_if(".json" not in backup_file.get("accept", ""), "#backup-file-input はJSONファイルだけを選べるようにしてください", errors)

    data_reset_button = parser.by_id.get("data-reset-button")
    data_reset_confirm = parser.by_id.get("data-reset-confirm")
    data_reset_confirm_button = parser.by_id.get("data-reset-confirm-button")
    data_reset_cancel_button = parser.by_id.get("data-reset-cancel-button")
    data_reset_status = parser.by_id.get("data-reset-status")
    fail_if(data_reset_button is None, "#data-reset-button が見つかりません", errors)
    fail_if(data_reset_confirm is None, "#data-reset-confirm が見つかりません", errors)
    fail_if(data_reset_confirm_button is None, "#data-reset-confirm-button が見つかりません", errors)
    fail_if(data_reset_cancel_button is None, "#data-reset-cancel-button が見つかりません", errors)
    fail_if(data_reset_status is None, "#data-reset-status が見つかりません", errors)
    if data_reset_confirm is not None:
        fail_if("hidden" not in data_reset_confirm, "端末データ削除の最終確認は初期状態で hidden にしてください", errors)
    if data_reset_status is not None:
        fail_if(data_reset_status.get("role") != "status", "#data-reset-status は role=status を維持してください", errors)

    fail_if(not parser.csp, "Content-Security-Policy が見つかりません", errors)
    if parser.csp:
        policy = parser.csp[0]
        for directive in ("connect-src 'none'", "object-src 'none'", "base-uri 'none'"):
            fail_if(directive not in policy, f"CSP に {directive} が必要です", errors)

    fail_if(
        parser.script_urls != REQUIRED_SCRIPT_ORDER,
        f"JavaScriptの読み込み順は {REQUIRED_SCRIPT_ORDER} を維持してください",
        errors,
    )

    theme_bootstrap_attrs = parser.script_attributes.get("theme-bootstrap.js", {})
    theme_runtime_attrs = parser.script_attributes.get("theme.js", {})
    fail_if("defer" in theme_bootstrap_attrs, "theme-bootstrap.js はCSS描画前に実行するため defer を付けないでください", errors)
    fail_if("defer" not in theme_runtime_attrs, "theme.js は defer で読み込んでください", errors)
    try:
        theme_bootstrap_position = parser.resource_order.index(("script", "theme-bootstrap.js"))
        stylesheet_position = parser.resource_order.index(("link", "styles.css"))
        fail_if(theme_bootstrap_position > stylesheet_position, "theme-bootstrap.js は styles.css より前に読み込んでください", errors)
    except ValueError:
        errors.append("theme-bootstrap.js または styles.css の読み込み位置を確認できません")

    for url in parser.resource_urls:
        fail_if(
            url.startswith(("http://", "https://", "//")),
            f"外部リソース参照は禁止です: {url}",
            errors,
        )

    script_sources = []
    for url in parser.script_urls:
        if url.startswith(("http://", "https://", "//")):
            continue

        script_ref = Path(url)
        unsafe_path = script_ref.is_absolute() or ".." in script_ref.parts
        fail_if(unsafe_path, f"安全でないスクリプトパスです: {url}", errors)
        if unsafe_path:
            continue

        script_path = ROOT / script_ref
        fail_if(not script_path.is_file(), f"読み込み対象のJavaScriptが見つかりません: {url}", errors)
        if script_path.is_file():
            script_sources.append(script_path.read_text(encoding="utf-8"))

    fail_if(not script_sources, "検査対象のJavaScriptが見つかりません", errors)
    javascript_source = "\n".join(script_sources)

    forbidden_js = (
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
    )
    for token in forbidden_js:
        fail_if(token in javascript_source, f"禁止しているDOM/コード実行/通信/保存領域APIを検出しました: {token}", errors)

    app_source = APP_PATH.read_text(encoding="utf-8")
    required_timer_boundary_flow = """if (remainingSeconds <= 0) {
      finishTimer();
      return;
    }
    stopTimer('再開');"""
    fail_if(
        required_timer_boundary_flow not in app_source,
        "0秒到達時は一時停止より先に finishTimer() へ流してください",
        errors,
    )
    fail_if("let storageAccessFailed = false;" not in app_source, "端末保存の失敗状態を保持してください", errors)
    fail_if("window.dispatchEvent(new Event('one:storage-error'));" not in app_source, "保存失敗時は表示側へ通知してください", errors)
    fail_if("return false;" not in app_source.split("function safeWrite", 1)[-1].split("function readTimerState", 1)[0], "safeWrite() は保存失敗を呼び出し側から判別できるようにしてください", errors)

    storage_status_source = STORAGE_STATUS_PATH.read_text(encoding="utf-8") if STORAGE_STATUS_PATH.is_file() else ""
    fail_if("STORAGE_HEALTH_PROBE_KEY = 'one.tabStorageProbe.v1'" not in storage_status_source, "端末保存確認は既存の一時プローブキーを再利用してください", errors)
    fail_if("addEventListener('one:storage-error'" not in storage_status_source, "利用中の保存失敗を端末保存表示へ反映してください", errors)
    fail_if("localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token" not in storage_status_source, "端末保存確認は書き込み後の読み戻しまで確認してください", errors)

    sound_source = SOUND_PATH.read_text(encoding="utf-8") if SOUND_PATH.is_file() else ""
    fail_if("const finishTimerWithoutCompletionSound = finishTimer;" not in sound_source, "完了音は既存 finishTimer() を保持して拡張してください", errors)
    fail_if("finishTimerWithoutCompletionSound();" not in sound_source, "完了音より先に本来の完了処理を実行してください", errors)
    fail_if("COMPLETION_SOUND_STORAGE_KEY = 'one.completionSound.v1'" not in sound_source, "完了音設定キーを変更する場合は互換性を確認してください", errors)

    wake_lock_source = WAKE_LOCK_PATH.read_text(encoding="utf-8") if WAKE_LOCK_PATH.is_file() else ""
    fail_if("WAKE_LOCK_STORAGE_KEY = 'one.wakeLock.v1'" not in wake_lock_source, "画面維持設定キーを変更する場合は互換性を確認してください", errors)
    fail_if("navigator.wakeLock.request('screen')" not in wake_lock_source, "画面維持はScreen Wake Lock APIのscreenロックだけを使用してください", errors)
    fail_if("document.visibilityState !== 'visible'" not in wake_lock_source, "非表示タブでは画面維持を取得しないでください", errors)
    fail_if("window.addEventListener('pagehide'" not in wake_lock_source, "ページ離脱時は画面維持を解放してください", errors)

    theme_bootstrap_source = THEME_BOOTSTRAP_PATH.read_text(encoding="utf-8") if THEME_BOOTSTRAP_PATH.is_file() else ""
    theme_source = THEME_PATH.read_text(encoding="utf-8") if THEME_PATH.is_file() else ""
    fail_if("THEME_STORAGE_KEY = 'one.theme.v1'" not in theme_bootstrap_source, "表示テーマ設定キーを変更する場合は互換性を確認してください", errors)
    fail_if("['system', 'light', 'dark']" not in theme_bootstrap_source, "表示テーマの許可値は system / light / dark に限定してください", errors)
    fail_if("document.documentElement.dataset.theme" not in theme_source, "手動テーマは documentElement の data-theme へ反映してください", errors)

    privacy_reset_source = PRIVACY_RESET_PATH.read_text(encoding="utf-8") if PRIVACY_RESET_PATH.is_file() else ""
    fail_if("PRIVACY_RESET_KEYS = new Set([" not in privacy_reset_source, "ONEの削除対象キーは明示的なSetで管理してください", errors)
    storage_keys = set(re.findall(r"['\"](one\.[A-Za-z0-9.]+)['\"]", javascript_source))
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
