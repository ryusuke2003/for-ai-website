from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
REQUIRED_SCRIPT_ORDER = ["app.js", "tab-guard.js", "backup.js", "shortcuts.js"]


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.by_id = {}
        self.csp = []
        self.resource_urls = []
        self.script_urls = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.by_id[element_id] = values

        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append(values.get("content", ""))

        if tag == "script" and values.get("src"):
            self.resource_urls.append(values["src"])
            self.script_urls.append(values["src"])
        if tag == "link" and values.get("href"):
            self.resource_urls.append(values["href"])


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

    done_button = parser.by_id.get("done-button")
    fail_if(done_button is None, "#done-button が見つかりません", errors)
    if done_button is not None:
        fail_if("disabled" not in done_button, "#done-button は初期状態で disabled にしてください", errors)

    discard_button = parser.by_id.get("discard-button")
    fail_if(discard_button is None, "#discard-button が見つかりません", errors)
    if discard_button is not None:
        fail_if("hidden" not in discard_button, "#discard-button は初期状態で hidden にしてください", errors)

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
    )
    for token in forbidden_js:
        fail_if(token in javascript_source, f"禁止しているDOM/コード実行/通信APIを検出しました: {token}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)

    print("Static security and accessibility checks passed.")


if __name__ == "__main__":
    main()
