from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
APP_PATH = ROOT / "app.js"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.by_id = {}
        self.csp = []
        self.resource_urls = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.by_id[element_id] = values

        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append(values.get("content", ""))

        if tag == "script" and values.get("src"):
            self.resource_urls.append(values["src"])
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

    fail_if(not parser.csp, "Content-Security-Policy が見つかりません", errors)
    if parser.csp:
        policy = parser.csp[0]
        for directive in ("connect-src 'none'", "object-src 'none'", "base-uri 'none'"):
            fail_if(directive not in policy, f"CSP に {directive} が必要です", errors)

    for url in parser.resource_urls:
        fail_if(
            url.startswith(("http://", "https://", "//")),
            f"外部リソース参照は禁止です: {url}",
            errors,
        )

    app_source = APP_PATH.read_text(encoding="utf-8")
    forbidden_js = (
        ".innerHTML",
        "insertAdjacentHTML",
        "document.write",
        "eval(",
        "new Function(",
    )
    for token in forbidden_js:
        fail_if(token in app_source, f"危険なDOM/コード実行APIを検出しました: {token}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)

    print("Static security and accessibility checks passed.")


if __name__ == "__main__":
    main()
