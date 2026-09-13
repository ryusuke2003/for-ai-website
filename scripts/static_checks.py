from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
THEME_BOOTSTRAP_PATH = ROOT / "public" / "theme-bootstrap.js"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.script_urls = []
        self.module_script_urls = []
        self.script_attributes = {}
        self.resource_urls = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
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


def main():
    parser = PageParser()
    parser.feed(INDEX_PATH.read_text(encoding="utf-8"))
    parser.close()

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

    print("Static public asset and legacy boundaries passed; React behavior is covered by Vitest.")


if __name__ == "__main__":
    main()
